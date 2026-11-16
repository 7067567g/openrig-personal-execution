// OPR.0.4.4.15 — the SHARED daemon→daemon HTTP core (arch cell 1, RATIFIED).
//
// Extracted from topology/remote-up-leaf.ts so the P4 aggregation fan-out
// does not mint a second copy of security-adjacent transport code (bearer
// resolution + bounded-abort discipline + status classification). The
// up-leaf is now a thin consumer that FORMATS this module's structured
// result into its shipped error strings (its tests byte-preserved).
//
// DEADLINE IS A REQUIRED ARGUMENT (arch sharpening, no module default):
// the up-leaf passes its 120s long-running rig-up budget at ITS call-site;
// the attention aggregator passes its 5s read-class deadline at ITS
// call-site. A buried default would invite the next consumer to silently
// inherit the wrong class.
//
// The G-R2B1-1 discipline is structural here: ONE deadline armed through
// the WHOLE exchange — request AND body parse (2xx or error body). A host
// that sends headers and never finishes the body yields a structured
// timeout, never a hung caller. The body race is explicit against the
// signal (a hand-built/proxied Response is not necessarily wired to the
// controller — no trust in fetch internals).
import { readFileSync } from "node:fs";
/** Mirrors the CLI's resolveRemoteBearer (host-registry.ts): at-most-one of
 *  bearer_env / bearer_file, resolved at call time. Neither configured is an
 *  anonymous (URL-only) host — a tokenless daemon; ok with no token, so no
 *  Authorization header is sent. A configured-but-unresolvable pointer still
 *  fails (fail-closed). */
export function resolveBearer(host, deps) {
    const env = deps.env ?? process.env;
    const readFile = deps.readFile ?? ((p) => readFileSync(p, "utf-8"));
    if (host.bearer_env) {
        const token = env[host.bearer_env]?.trim();
        if (token)
            return { ok: true, token };
        return { ok: false, detail: `bearer env var ${host.bearer_env} is not set or empty for host ${host.id}` };
    }
    if (host.bearer_file) {
        try {
            const token = readFile(host.bearer_file).trim();
            if (token)
                return { ok: true, token };
            return { ok: false, detail: `bearer file ${host.bearer_file} is empty for host ${host.id}` };
        }
        catch {
            return { ok: false, detail: `bearer file ${host.bearer_file} not readable for host ${host.id}` };
        }
    }
    return { ok: true };
}
/** One bounded daemon→daemon JSON exchange. The single deadline covers
 *  request + body; every outcome is structured — this function never hangs
 *  and never throws. */
export async function remoteJsonRequest(host, path, opts) {
    const bearer = opts.resolvedBearer ?? resolveBearer(host, opts);
    if (!bearer.ok)
        return { ok: false, kind: "bearer", detail: bearer.detail };
    const fetchImpl = opts.fetchImpl ?? fetch;
    const url = `${host.url.replace(/\/$/, "")}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    let res;
    try {
        res = await fetchImpl(url, {
            method: opts.method,
            headers: {
                ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
                ...(bearer.token ? { Authorization: `Bearer ${bearer.token}` } : {}),
                ...(opts.headers ?? {}),
            },
            ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
            ...(opts.redirect !== undefined ? { redirect: opts.redirect } : {}),
            signal: controller.signal,
        });
    }
    catch (err) {
        clearTimeout(timer);
        if (controller.signal.aborted)
            return { ok: false, kind: "timeout", phase: "request", detail: "" };
        return { ok: false, kind: "network", detail: err.message };
    }
    // A redirect the caller won't follow is classified on its status alone; its body is never read.
    if (opts.redirect === "manual" && res.status >= 300 && res.status < 400) {
        clearTimeout(timer);
        await res.body?.cancel().catch(() => { });
        return { ok: false, kind: "http", status: res.status, detail: "" };
    }
    // Body parse under the SAME still-armed deadline, raced explicitly.
    const abortRace = new Promise((_resolve, reject) => {
        const onAbort = () => reject(new Error("body read aborted"));
        if (controller.signal.aborted)
            onAbort();
        else
            controller.signal.addEventListener("abort", onAbort, { once: true });
    });
    let payload;
    let bodyTimedOut = false;
    try {
        if (opts.maxBytes === undefined)
            payload = await Promise.race([res.json(), abortRace]);
        else {
            const text = await Promise.race([readBounded(res, opts.maxBytes), abortRace]);
            if (text === null) {
                return { ok: false, kind: "network", status: res.status, tooLarge: true, detail: `answer larger than ${opts.maxBytes} bytes` };
            }
            payload = JSON.parse(text);
        }
    }
    catch (err) {
        if (controller.signal.aborted)
            bodyTimedOut = true;
        else if (!(err instanceof SyntaxError)) {
            return { ok: false, kind: "network", status: res.status, outcome: "indeterminate",
                detail: `Response body could not be read after HTTP ${res.status}; operation outcome is unknown: ${err instanceof Error ? err.message : String(err)}` };
        }
        // Completed non-JSON body: payload stays undefined; status is the honest detail
    }
    finally {
        clearTimeout(timer);
    }
    if (bodyTimedOut)
        return { ok: false, kind: "timeout", phase: "body", status: res.status, detail: "" };
    if (res.status >= 200 && res.status < 300)
        return { ok: true, status: res.status, payload };
    const remoteError = payload && typeof payload === "object" && typeof payload.error === "string"
        ? payload.error
        : "";
    return { ok: false, kind: "http", status: res.status, detail: remoteError };
}
/** The body as text, or null once it passes `maxBytes` (the rest isn't read). */
async function readBounded(res, maxBytes) {
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
        await res.body?.cancel().catch(() => { });
        return null;
    }
    if (!res.body)
        return "";
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => { });
            return null;
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
}
/** One bounded daemon→daemon GET, body passed through as text for ANY origin
 *  status (arch P3 verbatim rule). Same bearer resolution + single-deadline +
 *  explicit body race discipline as remoteJsonRequest; never hangs, never
 *  throws. */
export async function remoteRawRequest(host, path, opts) {
    const bearer = resolveBearer(host, opts);
    if (!bearer.ok)
        return { ok: false, kind: "bearer", detail: bearer.detail };
    const fetchImpl = opts.fetchImpl ?? fetch;
    const url = `${host.url.replace(/\/$/, "")}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    let res;
    try {
        res = await fetchImpl(url, {
            method: "GET",
            headers: bearer.token ? { Authorization: `Bearer ${bearer.token}` } : {},
            signal: controller.signal,
        });
    }
    catch (err) {
        clearTimeout(timer);
        if (controller.signal.aborted)
            return { ok: false, kind: "timeout", phase: "request", detail: "" };
        return { ok: false, kind: "network", detail: err.message };
    }
    const abortRace = new Promise((_resolve, reject) => {
        const onAbort = () => reject(new Error("body read aborted"));
        if (controller.signal.aborted)
            onAbort();
        else
            controller.signal.addEventListener("abort", onAbort, { once: true });
    });
    let bodyText = "";
    let bodyTimedOut = false;
    try {
        bodyText = await Promise.race([res.text(), abortRace]);
    }
    catch (err) {
        if (controller.signal.aborted)
            bodyTimedOut = true;
        else
            return { ok: false, kind: "network", status: res.status,
                detail: `Response body could not be read after HTTP ${res.status}; operation outcome is unknown: ${err instanceof Error ? err.message : String(err)}` };
    }
    finally {
        clearTimeout(timer);
    }
    if (bodyTimedOut)
        return { ok: false, kind: "timeout", phase: "body", status: res.status, detail: "" };
    return { ok: true, status: res.status, contentType: res.headers.get("content-type") ?? "application/json", bodyText };
}
//# sourceMappingURL=remote-daemon-http.js.map