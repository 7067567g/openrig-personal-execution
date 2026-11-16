import { DaemonConnectionError, DaemonTimeoutError, remoteDaemonClient } from "./client.js";
import { loadHostRegistry, resolveHost, resolveRemoteBearer, bearerAuthHeaders, classifyHttpFailedStep, classifyHttpError } from "./host-registry.js";
import { resolveOriginSelfHostId } from "./daemon-lifecycle.js";
// Connection failures that prove the request never reached the remote daemon. Codes the kernel can also report on a
// socket that already sent the request (route loss, an interface going down, a firewall change mid-flow: EHOSTUNREACH,
// ENETUNREACH, EHOSTDOWN, ENETDOWN, EPERM, EACCES) are left out, so they read as an unknown outcome.
const NOT_CONNECTED_CODES = new Set([
    "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EADDRNOTAVAIL", "UND_ERR_CONNECT_TIMEOUT", "ERR_INVALID_URL",
]);
function requestMayHaveArrived(err) {
    if (err instanceof DaemonTimeoutError)
        return true;
    if (err instanceof DaemonConnectionError)
        return err.causeCode === undefined || !NOT_CONNECTED_CODES.has(err.causeCode);
    return true;
}
export async function runRemoteHttpOp(hostId, method, apiPath, body, deps, 
// OPR.0.4.6.MH4 — optional per-call deadline (additive; absent = the
// DaemonClient default). Every remote call site names its own budget.
opts) {
    const loader = deps.hostRegistryLoader ?? loadHostRegistry;
    const registry = loader();
    if (!registry.ok) {
        return { ok: false, failedStep: "remote-daemon-unreachable", error: registry.error };
    }
    const resolved = resolveHost(registry.registry, hostId);
    if (!resolved.ok) {
        return { ok: false, failedStep: "remote-daemon-unreachable", error: resolved.error };
    }
    const host = resolved.host;
    if (host.transport === "ssh") {
        return { ok: false, failedStep: "remote-command-failed", error: `host ${hostId} uses SSH transport; HTTP --host not available` };
    }
    const httpHost = host;
    const bearerResult = resolveRemoteBearer(httpHost);
    if (!bearerResult.ok) {
        return { ok: false, failedStep: bearerResult.failedStep, error: bearerResult.error };
    }
    // A4: the SINGLE remote-origin construction for the 8 modules that route through this chokepoint —
    // stamp the origin triple (fail-open to 2-part when the local selfHostId is unavailable / no lifecycleDeps).
    const originSelfHostId = deps.lifecycleDeps ? await resolveOriginSelfHostId(deps.lifecycleDeps) : undefined;
    const client = remoteDaemonClient(deps.clientFactory, httpHost.url, originSelfHostId);
    const headers = bearerAuthHeaders(bearerResult.token);
    const requestOptions = opts.timeoutMs !== undefined ? { headers, timeoutMs: opts.timeoutMs } : { headers };
    try {
        const res = method === "POST"
            ? await client.post(apiPath, body, requestOptions)
            : await client.get(apiPath, requestOptions);
        const failedStep = classifyHttpFailedStep(res.status);
        if (failedStep !== "none") {
            // Carry the origin response body on failures too (additive): the
            // remote route's own error text is the honest detail a caller
            // surfaces beside the step class.
            return { ok: false, failedStep, error: `HTTP ${res.status}`, data: res.data };
        }
        return { ok: true, failedStep: "none", data: res.data };
    }
    catch (err) {
        return {
            ok: false,
            failedStep: classifyHttpError(err),
            error: err.message,
            ...(requestMayHaveArrived(err) ? { outcomeUnknown: true } : {}),
        };
    }
}
export async function lookupRemoteRigId(hostId, handle, deps) {
    const psResult = await runRemoteHttpOp(hostId, "GET", "/api/ps?includeArchived=true", undefined, deps, {});
    if (!psResult.ok)
        return { kind: "unavailable", error: psResult.error };
    if (!Array.isArray(psResult.data))
        return { kind: "unavailable", error: "the host's rig list was not readable" };
    const rows = psResult.data.filter((r) => r !== null && typeof r === "object");
    const targetable = (r) => typeof r.rigId === "string";
    const exactId = rows.find((r) => targetable(r) && r.rigId === handle);
    if (exactId && targetable(exactId))
        return { kind: "resolved", rigId: exactId.rigId, byName: false };
    const byName = rows.filter((r) => r.name === handle && !r.archivedAt);
    if (byName.length > 1)
        return { kind: "ambiguous", count: byName.length, ids: byName.filter(targetable).map((r) => r.rigId) };
    const only = byName[0];
    if (only && targetable(only))
        return { kind: "resolved", rigId: only.rigId, byName: true };
    return { kind: "not_found" };
}
export async function resolveRemoteRigId(hostId, handle, deps) {
    const lookup = await lookupRemoteRigId(hostId, handle, deps);
    switch (lookup.kind) {
        case "resolved": return { ok: true, rigId: lookup.rigId };
        case "unavailable": return { ok: false, error: `cannot resolve rig on host ${hostId}: ${lookup.error}` };
        case "ambiguous":
            return { ok: false, error: `ambiguous rig name "${handle}" on host ${hostId}: ${lookup.count} active rigs share that name. Use the rig id instead.` };
        case "not_found": return { ok: false, error: `rig "${handle}" not found on host ${hostId}` };
    }
}
//# sourceMappingURL=remote-host-ops.js.map