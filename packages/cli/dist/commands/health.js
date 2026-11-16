import { readFileSync } from "node:fs";
import { Command, InvalidArgumentError, Option } from "commander";
import { HEALTH_SEVERITIES, HEALTH_STATUSES, } from "../../daemon/dist/health-projection-surface.js";
import { DaemonClient, DaemonConnectionError, DaemonResponseError, DaemonTimeoutError, } from "../client.js";
import { getDaemonStatus, getDaemonUrl, statusGuardMessage, } from "../daemon-lifecycle.js";
import { realDeps } from "./daemon.js";
import { identityRoutingHint, resolveIdentitySource } from "./whoami.js";
import { shellQuote } from "../cross-host-executor.js";
import { omittedReadField, readView } from "../read-view.js";
function diagnosisPreview(entry) {
    const omitted = [];
    // ponytail: omit only known evidence payloads; keep current decisions and unknowns intact.
    function without(record, keys, prefix = "") {
        const copy = { ...record };
        for (const key of keys) {
            const value = copy[key];
            if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length))
                continue;
            omitted.push(omittedReadField(`${prefix}${key}`, value));
            delete copy[key];
        }
        return copy;
    }
    const result = without(entry, ["receipts", "guidance"]);
    result.row = without(entry.row, ["body", "chainOfRecord"], "row.");
    result.packet = without(entry.packet, ["finding", "authority", "instructions"], "packet.");
    result.finding = without(entry.finding, ["evidence"], "finding.");
    if (entry.finding.ceremony) {
        result.finding.ceremony = { ...entry.finding.ceremony,
            workflowReceipts: entry.finding.ceremony.workflowReceipts.map((receipt, index) => {
                const envelope = without(receipt, ["evidence"], `finding.ceremony.workflowReceipts[${index}].`);
                const evidence = receipt.evidence;
                // These are the existing cut/acceptance identity spellings, not a verdict on the receipt.
                const identity = evidence && typeof evidence === "object" && !Array.isArray(evidence)
                    ? Object.fromEntries(Object.entries(evidence).filter(([key, value]) => ["candidate", "candidateSha", "candidate_sha", "cutSha", "tree", "verdict", "evidenceRef", "evidence_ref"].includes(key)
                        && typeof value === "string"))
                    : {};
                return { ...envelope, evidenceIdentity: identity };
            }),
        };
    }
    result.authority = entry.authority.map((ref, index) => without(ref, ["content"], `authority[${index}].`));
    return { ...result, readView: readView(entry, `rig health diagnosis show ${shellQuote(entry.row.qitemId)} --full --json`, omitted) };
}
const HEALTH_ERROR_SCHEMA = "openrig.health-error/v0alpha1";
function defaultDeps() {
    return {
        lifecycleDeps: realDeps(),
        clientFactory: (baseUrl) => new DaemonClient(baseUrl),
        resolveIdentity: () => resolveIdentitySource({}),
    };
}
function parseLimit(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
        throw new InvalidArgumentError("must be an integer from 1 to 200");
    }
    return parsed;
}
function emitError(error, json) {
    if (json) {
        console.log(JSON.stringify(error));
    }
    else {
        console.error(`Error: ${error.message}`);
        console.error(`  Next inspection: ${error.nextInspection}`);
        if (error.hint)
            console.error(`  ${error.hint}`);
    }
    process.exitCode = 1;
}
function daemonError(details) {
    return {
        schema: HEALTH_ERROR_SCHEMA,
        error: "health_daemon_unavailable",
        message: "The health projection could not be read because the daemon did not respond.",
        nextInspection: "rig daemon status",
        details,
    };
}
function responseError(status, data) {
    const daemonCode = typeof data === "object" && data !== null && typeof data.error === "string"
        ? data.error
        : null;
    if (status === 503 && daemonCode === "health_projection_unavailable") {
        return {
            schema: HEALTH_ERROR_SCHEMA,
            error: daemonCode,
            message: "The daemon is reachable, but its health projection is unavailable.",
            nextInspection: "rig daemon status",
        };
    }
    if (status === 404 && daemonCode === "health_finding_not_found") {
        return {
            schema: HEALTH_ERROR_SCHEMA,
            error: daemonCode,
            message: "No health finding exists with that ID in the current projection.",
            nextInspection: "rig health --instance --json",
        };
    }
    if (status === 404 && daemonCode === "not_found") {
        return {
            schema: HEALTH_ERROR_SCHEMA,
            error: "health_projection_unavailable",
            message: "The daemon is reachable, but it does not expose the health projection.",
            nextInspection: "rig --version",
            details: data,
        };
    }
    return {
        schema: HEALTH_ERROR_SCHEMA,
        error: "health_query_failed",
        message: `The daemon rejected the health query (HTTP ${status}).`,
        nextInspection: "rig health --help",
        details: data,
    };
}
async function readyClient(deps, json) {
    const status = await getDaemonStatus(deps.lifecycleDeps, { cleanupStaleState: false });
    if (status.state !== "running" || status.healthy === false) {
        emitError(daemonError(statusGuardMessage(status)), json);
        return null;
    }
    return deps.clientFactory(getDaemonUrl(status));
}
async function readSelfSeatId(client, deps, json) {
    const source = deps.resolveIdentity();
    if (!source) {
        emitError({
            schema: HEALTH_ERROR_SCHEMA,
            error: "health_identity_unavailable",
            message: "The current seat identity is unavailable, so self health cannot be scoped safely.",
            nextInspection: "rig whoami --json",
        }, json);
        return null;
    }
    const params = new URLSearchParams();
    if (source.nodeId)
        params.set("nodeId", source.nodeId);
    else if (source.sessionName)
        params.set("sessionName", source.sessionName);
    params.set("compact", "1");
    const response = await client.get(`/api/whoami?${params.toString()}`);
    if (response.status === 409) {
        emitError({
            schema: HEALTH_ERROR_SCHEMA,
            error: "health_identity_ambiguous",
            message: "More than one managed seat matches the current identity.",
            nextInspection: "rig ps --nodes -A",
            details: response.data,
        }, json);
        return null;
    }
    if (response.status >= 400) {
        emitError({
            schema: HEALTH_ERROR_SCHEMA,
            error: "health_identity_unavailable",
            message: "The daemon could not resolve the current seat identity.",
            nextInspection: "rig whoami --json",
            details: response.data,
            ...(response.status === 404 ? { hint: await identityRoutingHint(client) } : {}),
        }, json);
        return null;
    }
    const identity = response.data["identity"];
    const nodeId = typeof identity === "object" && identity !== null
        ? identity["nodeId"]
        : null;
    if (typeof nodeId !== "string" || nodeId.length === 0) {
        emitError({
            schema: HEALTH_ERROR_SCHEMA,
            error: "health_identity_indeterminate",
            message: "The identity response did not carry a stable node ID, so self health is indeterminate.",
            nextInspection: "rig whoami --full --json",
            details: response.data,
        }, json);
        return null;
    }
    return nodeId;
}
function scopeLabel(scope) {
    switch (scope.type) {
        case "instance": return `instance:${scope.instanceId}`;
        case "rig": return `rig:${scope.rigId}`;
        case "seat": return `seat:${scope.seatId}`;
        case "mission": return `mission:${scope.missionId}`;
        case "slice": return `slice:${scope.sliceId}`;
    }
}
function renderList(projection) {
    const evaluated = projection.evaluatedAt ?? "unavailable";
    console.log(`Fleet health — evaluated=${evaluated} findings=${projection.total} limit=${projection.limit}`);
    for (const c of projection.coverage ?? []) {
        if (!c.partial)
            continue;
        if (c.status === "unavailable") {
            console.log(`UNAVAILABLE: ${c.source}: ${c.reason}. This source was not assessed; the result is partial.`);
            continue;
        }
        console.log(`PARTIAL: ${c.source} evaluated ${c.evaluated} of ${c.total} ${c.unit} (limit ${c.limit}; ${c.omitted} omitted; order: ${c.order}). Omitted ${c.unit} were not evaluated and are not healthy.`);
    }
    if (projection.records.length === 0) {
        console.log("No health findings match this bounded query. This is not a healthy assertion.");
        console.log("Next inspection: widen only as needed with `rig health --instance --json`.");
        return;
    }
    for (const record of projection.records) {
        console.log(`${record.id}  ${record.severity}  ${record.status}  ${record.detector}`);
        console.log(`  ${scopeLabel(record.scope)}  ${record.confidence} confidence  freshness=${record.freshness.state}${record.indeterminateReason ? `  indeterminate=${record.indeterminateReason}` : ""}`);
        console.log(`  ${record.summary}`);
        if (record.operatingPosture)
            console.log(`  Operating posture: ${record.operatingPosture.posture} (${record.operatingPosture.source}); phase=${record.operatingPosture.context?.phase.value ?? "unknown"}`);
    }
    if (projection.truncated) {
        console.log(`Truncated at ${projection.limit} of ${projection.total}; narrow the scope or raise --limit (maximum 200).`);
    }
}
function renderExplanation(record) {
    console.log(`Health finding ${record.id}`);
    console.log(`  Detector:    ${record.detector} (${record.category})`);
    console.log(`  Scope:       ${scopeLabel(record.scope)}`);
    console.log(`  Outcome:     ${record.severity} / ${record.status} / ${record.confidence} confidence`);
    console.log(`  Observed:    ${record.startedAt ?? "unavailable"} → ${record.lastObservedAt ?? "unavailable"}`);
    console.log(`  Window:      ${record.window.startedAt} → ${record.window.endedAt}; source=${record.window.source}; limit=${record.window.limit}; retention=${record.window.retentionSeconds}s`);
    console.log(`  Freshness:   ${record.freshness.state}; evaluated=${record.freshness.evaluatedAt}; newest=${record.freshness.newestSourceAt ?? "unavailable"}; max-age=${record.freshness.maxAgeSeconds}s; age=${record.freshness.ageSeconds ?? "unavailable"}s`);
    if (record.indeterminateReason)
        console.log(`  Indeterminate: ${record.indeterminateReason}`);
    console.log(`  Rule:        ${record.threshold}`);
    console.log(`  Policy:      ${record.policyVersion ?? "not reported by source"}`);
    if (record.operatingPosture)
        console.log(`  Posture:     ${JSON.stringify(record.operatingPosture)}`);
    console.log(`  Explanation: ${record.explanation}`);
    console.log(`  Evidence:    ${JSON.stringify(record.evidence)}`);
    if (record.ceremony)
        console.log(`  Diagnosis stage: ${record.ceremony.stage}\n  Normal context: ${JSON.stringify(record.ceremony)}`);
    console.log(`  Inspect:     ${record.suggestedInspection}`);
}
async function guardedRequest(request, json) {
    try {
        return await request();
    }
    catch (error) {
        const details = error instanceof DaemonTimeoutError
            ? { kind: "timeout", message: error.message }
            : error instanceof DaemonResponseError
                ? { kind: "unreadable-response", status: error.status, bodySnippet: error.bodySnippet }
                : error instanceof DaemonConnectionError
                    ? { kind: "connection", message: error.message }
                    : { kind: "unexpected", message: error instanceof Error ? error.message : String(error) };
        emitError(daemonError(details), json);
        return null;
    }
}
export function healthCommand(depsOverride) {
    const deps = depsOverride ?? defaultDeps();
    const command = new Command("health")
        .description("Inspect read-only, explainable system health records")
        .addOption(new Option("--self", "Inspect the current seat (default)").conflicts(["seat", "rig", "instance"]))
        .addOption(new Option("--seat <node-id>", "Inspect one seat by stable node ID").conflicts(["self", "rig", "instance"]))
        .addOption(new Option("--rig <rig-id>", "Inspect findings whose canonical scope is this rig").conflicts(["self", "seat", "instance"]))
        .addOption(new Option("--instance [instance-id]", "Inspect the whole local instance, or one canonical instance scope by ID").conflicts(["self", "seat", "rig"]))
        .addOption(new Option("--severity <severity>", "Filter by severity").choices([...HEALTH_SEVERITIES]))
        .addOption(new Option("--status <status>", "Filter by finding status").choices([...HEALTH_STATUSES]))
        .option("--limit <count>", "Maximum findings (1-200)", parseLimit, 100)
        .option("--json", "JSON output; diagnosis list/show need --full for complete evidence")
        .option("--actor <name>", "Attribute explicit diagnosis writes when operating outside a managed seat")
        .addHelpText("after", `
The default scope is the current seat. --instance without an ID is the bounded
instance-wide projection. Empty output is not a healthy assertion. This command
list/explain never mutate. Diagnosis mutations use explicit subcommands; automatic diagnostic presentation is opt-in policy.`);
    command.action(async (options) => {
        const json = Boolean(options.json);
        const client = await readyClient(deps, json);
        if (!client)
            return;
        let scopeType;
        let scopeId;
        if (options.seat) {
            scopeType = "seat";
            scopeId = options.seat;
        }
        else if (options.rig) {
            scopeType = "rig";
            scopeId = options.rig;
        }
        else if (typeof options.instance === "string") {
            scopeType = "instance";
            scopeId = options.instance;
        }
        else if (!options.instance) {
            const seatId = await guardedRequest(() => readSelfSeatId(client, deps, json).then((data) => ({ status: data === null ? 1 : 0, data })), json);
            if (!seatId || seatId.data === null)
                return;
            scopeType = "seat";
            scopeId = seatId.data;
        }
        const params = new URLSearchParams();
        if (scopeType && scopeId) {
            params.set("scope_type", scopeType);
            params.set("scope_id", scopeId);
        }
        params.set("limit", String(options.limit ?? 100));
        if (options.severity)
            params.set("severity", options.severity);
        if (options.status)
            params.set("status", options.status);
        const response = await guardedRequest(() => client.get(`/api/health?${params.toString()}`), json);
        if (!response)
            return;
        if (response.status >= 400) {
            emitError(responseError(response.status, response.data), json);
            return;
        }
        if (json)
            console.log(JSON.stringify(response.data));
        else
            renderList(response.data);
    });
    command
        .command("explain <finding-id>")
        .description("Explain one health finding from its canonical bounded record")
        .option("--json", "Emit the canonical daemon health record as JSON")
        .action(async (findingId, options) => {
        const json = Boolean(options.json || command.opts().json);
        const client = await readyClient(deps, json);
        if (!client)
            return;
        const response = await guardedRequest(() => client.get(`/api/health/${encodeURIComponent(findingId)}`), json);
        if (!response)
            return;
        if (response.status >= 400) {
            emitError(responseError(response.status, response.data), json);
            return;
        }
        if (json)
            console.log(JSON.stringify(response.data));
        else
            renderExplanation(response.data);
    });
    async function diagnosisRequest(path, options, payload) {
        const json = Boolean(options.json || command.opts().json);
        const client = await readyClient(deps, json);
        if (!client)
            return;
        const response = await guardedRequest(() => payload === undefined ? client.get(`/api/health-diagnosis${path}`) : client.post(`/api/health-diagnosis${path}`, { ...payload, actor: command.opts().actor }), json);
        if (!response)
            return;
        if (response.status >= 400) {
            console.error(JSON.stringify(response.data));
            process.exitCode = 1;
            return;
        }
        const occurrenceRead = payload === undefined && path !== "/policy" && path !== "/checkpoints";
        if (options.full || json || path === "/policy" || path === "/checkpoints" || path === "/evaluate" || path.endsWith("/notify")) {
            const data = occurrenceRead && !options.full
                ? (Array.isArray(response.data) ? response.data.map((entry) => diagnosisPreview(entry)) : diagnosisPreview(response.data))
                : response.data;
            console.log(JSON.stringify(data, null, json ? undefined : 2));
        }
        else {
            const entries = Array.isArray(response.data) ? response.data : [response.data];
            if (!entries.length)
                console.log("No diagnostic occurrences. This is not a healthy assertion.");
            for (const entry of entries) {
                console.log(`${entry.row.qitemId}  ${entry.finding.status}  ${entry.finding.detector}`);
                console.log(`  Disposition: ${entry.disposition?.verdict ?? "awaiting agent investigation"}`);
                if (path) {
                    console.log(`  Queue: ${entry.row.state ?? "unknown"}  Owner: ${entry.row.destinationSession ?? "unknown"}  Blocker: ${entry.row.blockedOn ?? "none recorded"}`);
                    if (entry.notificationReadiness)
                        console.log(`  Human readiness: ${entry.notificationReadiness.ready ? "ready" : "unavailable"} — ${entry.notificationReadiness.reason}`);
                    if (entry.humanDelivery)
                        console.log(`  Human delivery: ${entry.humanDelivery.outcome} (${entry.humanDelivery.qitemId})`);
                    console.log(`  Finding: ${entry.finding.id}  Policy: ${entry.finding.policyVersion ?? "unreported"}`);
                    console.log(`  ${entry.finding.explanation}`);
                    if (entry.finding.operatingPosture)
                        console.log(`  Posture: ${entry.finding.operatingPosture.posture} (${entry.finding.operatingPosture.source}); phase=${entry.finding.operatingPosture.context?.phase.value ?? "unknown"}; ${entry.finding.operatingPosture.reason}`);
                    console.log(`  Start: ${entry.disposition?.causalStart ?? "unknown"}`);
                    console.log(`  Steering: ${entry.disposition?.steering ?? "not yet recorded"}`);
                    console.log(`  Uncertainty: ${entry.disposition?.uncertainty ?? entry.finding.indeterminateReason ?? "diagnosis pending"}`);
                    if (entry.assessment)
                        console.log(`  Attributed assessment: ${entry.assessment.actor ?? "unknown"} at ${entry.assessment.at}`);
                    const correction = entry.disposition?.correction;
                    if (correction) {
                        console.log(`  Applicability: ${correction.applicability}`);
                        console.log(`  Causal judgment: ${correction.causalJudgment}`);
                        console.log(`  Action (${correction.action.state}): ${correction.action.summary}`);
                    }
                    console.log(`  Later behavioral effect (owner report): ${correction?.effect.state ?? "unobserved"}${correction ? " — " + correction.effect.summary : " — a disposition or clearance alone is not changed behavior"}`);
                    for (const ref of entry.authority)
                        console.log(`  ${ref.role ?? "Authority"} (${ref.state}): ${ref.path}${ref.selectedBy ? " selected by " + ref.selectedBy : ""}${ref.reason ? " — " + ref.reason : ""}`);
                    if (occurrenceRead) {
                        const view = diagnosisPreview(entry).readView;
                        console.log(`  Evidence preview; full record ${view.fullJsonBytes} JSON bytes: ${view.fullCommand}`);
                    }
                    else
                        console.log(`  ${entry.packet.instructions}`);
                }
            }
        }
    }
    function fromFile(file) {
        const text = readFileSync(file, "utf8");
        if (Buffer.byteLength(text) > 1048576)
            throw new Error("Health input exceeds 1 MiB");
        return JSON.parse(text);
    }
    command.command("policy").description("Inspect effective policy and engine state; apply edited JSON with --file")
        .option("--file <path>", "Apply policy JSON with an audit record").option("--json")
        .action(async (o) => diagnosisRequest("/policy", o, o.file ? { value: fromFile(o.file) } : undefined));
    command.command("checkpoint").description("Inspect or submit an outcome-boundary lineage census (not a per-edit ritual)")
        .option("--file <path>", "Submit checkpoint JSON with exact queue and product evidence").option("--json")
        .action(async (o) => diagnosisRequest("/checkpoints", o, o.file ? { value: fromFile(o.file) } : undefined));
    command.command("diagnose").description("Preview policy admission; --apply creates or re-presents bounded diagnostic context")
        .option("--apply").option("--json").action(async (o) => diagnosisRequest("/evaluate", o, { apply: Boolean(o.apply) }));
    const diagnosis = command.command("diagnosis").description("Read occurrences and record agent-owned dispositions");
    diagnosis.command("list").description("List occurrence summaries; evidence payloads require --full")
        .option("--json", "Summary array with explicit omitted fields and per-occurrence expansion commands")
        .option("--full", "Complete records including all evidence and receipts; may be large")
        .action(async (o) => diagnosisRequest("", o));
    diagnosis.command("show <qitem-id>").description("Inspect current state and decisions; expand retained evidence deliberately")
        .option("--json", "Summary JSON with omitted fields, original byte size and exact full command")
        .option("--full", "Complete original record; use --full --json for lossless JSON (may be large)")
        .action(async (id, o) => diagnosisRequest(`/${encodeURIComponent(id)}`, o));
    diagnosis.command("record <qitem-id>").requiredOption("--file <path>", "Disposition JSON with verdict, causalStart, steering, uncertainty, evidenceRefs").option("--json")
        .action(async (id, o) => diagnosisRequest(`/${encodeURIComponent(id)}/disposition`, o, { value: fromFile(o.file) }));
    diagnosis.command("notify <qitem-id>").description("Explicitly request human delivery under policy and verified connector readiness").option("--json")
        .action(async (id, o) => diagnosisRequest(`/${encodeURIComponent(id)}/notify`, o, {}));
    return command;
}
//# sourceMappingURL=health.js.map