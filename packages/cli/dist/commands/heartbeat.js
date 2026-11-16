import { execFile } from "node:child_process";
import fs from "node:fs";
import nodePath from "node:path";
import { Command } from "commander";
const DEFAULT_FIRST_PROOF_SECONDS = 7_200;
const DEFAULT_HEARTBEAT_SECONDS = 7_200;
const TIMESTAMP_PATTERN = String.raw `\d{4}-\d{2}-\d{2}T[\d:~]+(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?`;
const STATE_RANK = {
    stalled: 0,
    unproven: 1,
    blocked: 2,
    "checked-out": 3,
    "proven-active": 4,
    parked: 5,
    done: 6,
};
export function heartbeatCommand(depsOverride) {
    const cmd = new Command("heartbeat")
        .description("Show workflow execution proof state from queue files")
        .addHelpText("after", `
Examples:
  rig heartbeat --rig openrig-pm
  rig heartbeat --rig openrig-pm --json
  rig heartbeat --rig openrig-pm --nudge

Default mode is read-only. --nudge only sends informational proof instructions
to stalled/unproven owners; it does not modify queue files or reroute work.`);
    cmd
        .option("--rig <name>", "Limit to a single rig")
        .option("--json", "JSON output for agents")
        .option("--nudge", "Send informational nudges to stalled/unproven owners")
        .option("--include-done", "Include done/handed-off queue items in output")
        .action(async (opts) => {
        const deps = depsOverride ?? {};
        const env = deps.env ?? process.env;
        const sharedDocsRoot = deps.sharedDocsRoot ?? resolveSharedDocsRoot(env);
        if (!sharedDocsRoot) {
            console.error("rig heartbeat: cannot resolve shared-docs root. Set RIGX_SHARED_DOCS_ROOT.");
            process.exitCode = 1;
            return;
        }
        const firstProofSeconds = readPositiveInt(env["HEARTBEAT_FIRST_PROOF_WINDOW"], DEFAULT_FIRST_PROOF_SECONDS);
        const heartbeatSeconds = readPositiveInt(env["HEARTBEAT_HEARTBEAT_CADENCE"], DEFAULT_HEARTBEAT_SECONDS);
        const now = deps.now?.() ?? new Date();
        const result = analyzeHeartbeat({
            sharedDocsRoot,
            rig: opts.rig,
            firstProofSeconds,
            heartbeatSeconds,
            includeDone: !!opts.includeDone,
            now,
        });
        if (opts.nudge) {
            const send = deps.send ?? defaultSend;
            result.nudgeResults = await sendHeartbeatNudges(result.items, send);
        }
        if (opts.json) {
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        printHumanHeartbeat(result);
    });
    return cmd;
}
export function analyzeHeartbeat(input) {
    const firstProofSeconds = input.firstProofSeconds ?? DEFAULT_FIRST_PROOF_SECONDS;
    const heartbeatSeconds = input.heartbeatSeconds ?? DEFAULT_HEARTBEAT_SECONDS;
    const now = input.now ?? new Date();
    const generatedAt = now.toISOString();
    const queueFiles = discoverQueueFiles(input.sharedDocsRoot, input.rig);
    const entries = queueFiles.flatMap((file) => parseQueueFile(input.sharedDocsRoot, file));
    const items = entries
        .map((entry) => classifyQueueEntry(entry, { now, firstProofSeconds, heartbeatSeconds }))
        .filter((item) => item !== null)
        .filter((item) => input.includeDone || item.executionState !== "done")
        .sort(compareHeartbeatItems);
    return {
        generatedAt,
        sharedDocsRoot: input.sharedDocsRoot,
        rigFilter: input.rig ?? null,
        windows: { firstProofSeconds, heartbeatSeconds },
        summary: summarize(items),
        items,
    };
}
export function parseQueueFile(sharedDocsRoot, queueFile) {
    const content = fs.readFileSync(queueFile, "utf8").replace(/\r\n/g, "\n");
    const rig = deriveRigName(sharedDocsRoot, queueFile);
    const owner = deriveOwner(queueFile);
    const session = deriveSessionName(owner, rig);
    const entries = [];
    const entryPattern = new RegExp(String.raw `(?:^|\n)---\nid:\s*(\S+)\n([\s\S]*?)\n---\n([\s\S]*?)(?=\n---\nid:\s*\S+\n|$)`, "g");
    for (const match of content.matchAll(entryPattern)) {
        const id = match[1];
        const meta = parseMetadata(match[2] ?? "");
        meta["id"] = id;
        const body = match[3] ?? "";
        const queueState = normalizeState(meta["state"] ?? "unknown");
        const title = body.match(/^###\s+(.+)$/m)?.[1]?.trim() ?? id;
        entries.push({
            id,
            rig,
            owner,
            session,
            title: title.slice(0, 120),
            queueState,
            queueFile,
            meta,
            body,
        });
    }
    return entries;
}
export function classifyQueueEntry(entry, opts) {
    const blockedOn = cleanNullable(entry.meta["blocked-on"]);
    if (entry.queueState === "blocked" || entry.queueState === "blocked-on") {
        return baseItem(entry, "blocked", opts.now, null, null, blockedOn);
    }
    if (entry.queueState === "deferred" || entry.queueState === "parked") {
        return baseItem(entry, "parked", opts.now, null, null, blockedOn);
    }
    if (entry.queueState === "done" || entry.queueState === "handed-off") {
        return baseItem(entry, "done", opts.now, null, null, blockedOn);
    }
    if (entry.queueState !== "in-progress") {
        return null;
    }
    const checkoutAt = firstStateTransitionTimestamp(entry.body, "in-progress")
        ?? cleanNullable(entry.meta["ts-created"]);
    const checkoutAgeSeconds = ageSeconds(checkoutAt, opts.now);
    const lastProof = latestProof(entry.body, opts.now);
    let executionState;
    if (lastProof && lastProof.ageSeconds <= opts.heartbeatSeconds) {
        executionState = "proven-active";
    }
    else if (lastProof) {
        executionState = "stalled";
    }
    else if (checkoutAgeSeconds != null && checkoutAgeSeconds > opts.firstProofSeconds) {
        executionState = "unproven";
    }
    else {
        executionState = "checked-out";
    }
    return baseItem(entry, executionState, opts.now, checkoutAt, lastProof, blockedOn);
}
export async function sendHeartbeatNudges(items, send) {
    const targets = items.filter((item) => item.executionState === "stalled" || item.executionState === "unproven");
    const results = [];
    for (const item of targets) {
        const proofCopy = item.executionState === "stalled" && item.lastProof
            ? `Last proof was ${formatAge(item.lastProof.ageSeconds)} ago.`
            : `No proof-of-work since checkout${item.checkoutAgeSeconds == null ? "." : ` ${formatAge(item.checkoutAgeSeconds)} ago.`}`;
        const text = [
            `[heartbeat-nudge] Your task \`${item.id}\` is ${item.executionState}. ${proofCopy}`,
            "If actively working, add a task-specific proof note to your queue item naming the artifact.",
            "If blocked, transition to blocked with reason. If pausing, transition to deferred with reason.",
        ].join(" ");
        const result = await send(item.session, text);
        results.push({ id: item.id, session: item.session, executionState: item.executionState, ...result });
    }
    return results;
}
function resolveSharedDocsRoot(env) {
    for (const key of ["RIGX_SHARED_DOCS_ROOT", "OPENRIG_SHARED_DOCS_ROOT"]) {
        const value = env[key];
        if (value && fs.existsSync(nodePath.join(value, "rigs")))
            return value;
    }
    return null;
}
function discoverQueueFiles(sharedDocsRoot, rig) {
    const base = rig
        ? nodePath.join(sharedDocsRoot, "rigs", rig, "state")
        : nodePath.join(sharedDocsRoot, "rigs");
    const files = [];
    walk(base, files);
    return files.filter((file) => file.endsWith(".queue.md")).sort();
}
function walk(dir, files) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        const fullPath = nodePath.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath, files);
        }
        else if (entry.isFile()) {
            files.push(fullPath);
        }
    }
}
function parseMetadata(text) {
    const meta = {};
    for (const line of text.split("\n")) {
        const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (match)
            meta[match[1].toLowerCase()] = match[2].trim();
    }
    return meta;
}
function normalizeState(state) {
    return state.trim().toLowerCase().replace(/_/g, "-");
}
function firstStateTransitionTimestamp(body, state) {
    const pattern = new RegExp(`(${TIMESTAMP_PATTERN})\\s*[-\u2014]\\s*${escapeRegex(state).replace("-", "[- ]")}`, "gi");
    const matches = Array.from(body.matchAll(pattern)).map((match) => match[1].replace("~", ""));
    return matches.length > 0 ? matches[0] : null;
}
function latestProof(body, now) {
    const proofs = [];
    for (const rawLine of body.split("\n")) {
        const line = rawLine.trim();
        if (!/\bproof\b/i.test(line))
            continue;
        const timestamp = line.match(new RegExp(`(${TIMESTAMP_PATTERN})`, "i"))?.[1]?.replace("~", "");
        if (!timestamp)
            continue;
        const path = extractEvidencePath(line);
        if (!path)
            continue;
        const age = ageSeconds(timestamp, now);
        if (age == null)
            continue;
        proofs.push({ at: timestamp, ageSeconds: age, line, path });
    }
    proofs.sort((a, b) => parseTimestamp(a.at).getTime() - parseTimestamp(b.at).getTime());
    return proofs.at(-1) ?? null;
}
function extractEvidencePath(line) {
    const backtickPath = Array.from(line.matchAll(/`([^`]+)`/g))
        .map((match) => match[1])
        .find(looksLikePath);
    if (backtickPath)
        return backtickPath;
    const tokenPath = line
        .split(/\s+/)
        .map((token) => token.replace(/[),.;:]+$/g, "").replace(/^["']|["']$/g, ""))
        .find(looksLikePath);
    return tokenPath ?? null;
}
function looksLikePath(value) {
    if (value.startsWith("/"))
        return value.length > 1;
    if (value.startsWith("./") || value.startsWith("../"))
        return true;
    if (/^[A-Za-z0-9_.-]+\.(md|txt|ts|tsx|js|jsx|json|jsonl|yaml|yml|toml|sqlite|db)$/i.test(value))
        return true;
    return /[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]+/.test(value);
}
function baseItem(entry, executionState, now, checkoutAt, lastProof, blockedOn) {
    return {
        id: entry.id,
        rig: entry.rig,
        owner: entry.owner,
        session: entry.session,
        title: entry.title,
        queueState: entry.queueState,
        executionState,
        queueFile: entry.queueFile,
        checkoutAt,
        checkoutAgeSeconds: ageSeconds(checkoutAt, now),
        lastProof,
        blockedOn,
    };
}
function ageSeconds(ts, now) {
    if (!ts)
        return null;
    const parsed = parseTimestamp(ts);
    if (!parsed)
        return null;
    return Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / 1000));
}
function parseTimestamp(raw) {
    const normalized = raw.trim().replace("~", "");
    const iso = /Z$|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
}
function summarize(items) {
    return {
        total: items.length,
        checkedOut: items.filter((item) => item.executionState === "checked-out").length,
        provenActive: items.filter((item) => item.executionState === "proven-active").length,
        stalled: items.filter((item) => item.executionState === "stalled").length,
        unproven: items.filter((item) => item.executionState === "unproven").length,
        blocked: items.filter((item) => item.executionState === "blocked").length,
        parked: items.filter((item) => item.executionState === "parked").length,
        done: items.filter((item) => item.executionState === "done").length,
    };
}
function compareHeartbeatItems(a, b) {
    const rankA = STATE_RANK[a.executionState];
    const rankB = STATE_RANK[b.executionState];
    if (rankA !== rankB)
        return rankA - rankB;
    if (a.rig !== b.rig)
        return a.rig.localeCompare(b.rig);
    if (a.owner !== b.owner)
        return a.owner.localeCompare(b.owner);
    return a.id.localeCompare(b.id);
}
function deriveRigName(sharedDocsRoot, queueFile) {
    const rel = nodePath.relative(nodePath.join(sharedDocsRoot, "rigs"), queueFile);
    return rel.split(nodePath.sep)[0] ?? "";
}
function deriveOwner(queueFile) {
    const parts = queueFile.split(nodePath.sep);
    const stateIndex = parts.lastIndexOf("state");
    if (stateIndex < 0 || stateIndex + 2 >= parts.length)
        return nodePath.basename(queueFile, ".queue.md");
    const pod = parts[stateIndex + 1];
    const member = nodePath.basename(parts[stateIndex + 2], ".queue.md");
    return `${pod}.${member}`;
}
function deriveSessionName(owner, rig) {
    const [pod, member] = owner.split(".", 2);
    return pod && member ? `${pod}-${member}@${rig}` : `${owner}@${rig}`;
}
function cleanNullable(value) {
    if (!value)
        return null;
    const trimmed = value.trim();
    return trimmed === "" || trimmed.toLowerCase() === "null" ? null : trimmed;
}
function readPositiveInt(value, fallback) {
    if (!value)
        return fallback;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function formatAge(seconds) {
    if (seconds < 60)
        return `${seconds}s`;
    if (seconds < 3_600)
        return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86_400)
        return `${Math.floor(seconds / 3_600)}h${Math.floor((seconds % 3_600) / 60)}m`;
    return `${Math.floor(seconds / 86_400)}d${Math.floor((seconds % 86_400) / 3_600)}h`;
}
function printHumanHeartbeat(result) {
    const title = result.rigFilter
        ? `WORKFLOW EXECUTION HEARTBEAT - ${result.rigFilter}`
        : "WORKFLOW EXECUTION HEARTBEAT - all rigs";
    console.log(title);
    console.log(`items: ${result.summary.total} | proven-active: ${result.summary.provenActive} | checked-out: ${result.summary.checkedOut} | stalled: ${result.summary.stalled} | unproven: ${result.summary.unproven} | blocked: ${result.summary.blocked} | parked: ${result.summary.parked} | done: ${result.summary.done}`);
    if (result.items.length === 0) {
        console.log("No workflow queue items found.");
    }
    else {
        console.log("");
        console.log(`${"execution".padEnd(15)} ${"queue".padEnd(12)} ${"task".padEnd(32)} ${"owner".padEnd(28)} ${"proof".padEnd(12)} age`);
        for (const item of result.items) {
            const proof = item.lastProof ? `${formatAge(item.lastProof.ageSeconds)} ago` : "-";
            const age = item.checkoutAgeSeconds == null ? "-" : formatAge(item.checkoutAgeSeconds);
            console.log(`${item.executionState.padEnd(15)} ${item.queueState.padEnd(12)} ${item.id.slice(0, 31).padEnd(32)} ${(item.rig + "/" + item.owner).padEnd(28)} ${proof.padEnd(12)} ${age}`);
        }
    }
    if (result.nudgeResults) {
        console.log("");
        console.log(`Nudges: ${result.nudgeResults.length}`);
        for (const nudge of result.nudgeResults) {
            console.log(`  ${nudge.session}: ${nudge.ok ? "sent" : "failed"} ${nudge.message}`);
        }
    }
}
function defaultSend(session, text) {
    return new Promise((resolve) => {
        execFile("rig", ["send", session, text], { timeout: 10_000 }, (error, stdout, stderr) => {
            if (error) {
                resolve({ ok: false, message: (stderr || error.message).trim() });
            }
            else {
                resolve({ ok: true, message: stdout.trim() || "sent" });
            }
        });
    });
}
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
//# sourceMappingURL=heartbeat.js.map