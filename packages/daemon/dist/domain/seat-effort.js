import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import { lstartToMinTs } from "./codex-thread-id.js";
/** The one resolver every managed continuation (fresh, successor, in-place restart) reads. */
export function resolveSeatEffort(node) {
    const choice = node.effortChoice?.trim() || null;
    const authored = node.effort?.trim() || null;
    const effective = choice ?? authored;
    return { choice, authored, effective, source: choice ? "seat_choice" : authored ? "authored" : "runtime_default" };
}
/** The seat's resolution from its node row. null: no such node. A database older than the
 *  effort_choice column resolves from nodes.effort alone, as launches did before it existed. */
export function readSeatEffort(db, nodeId) {
    try {
        const row = db.prepare("SELECT effort, effort_choice FROM nodes WHERE id = ?").get(nodeId);
        return row ? resolveSeatEffort({ effort: row.effort, effortChoice: row.effort_choice }) : null;
    }
    catch {
        try {
            const row = db.prepare("SELECT effort FROM nodes WHERE id = ?").get(nodeId);
            return row ? resolveSeatEffort({ effort: row.effort }) : null;
        }
        catch {
            return null;
        }
    }
}
/** No rule is picked. Each writer keeps what it did before seat choices existed: a restore launches
 *  the snapshot's authored effort and says so when the seat's saved choice differs; a spec refresh
 *  rewrites only the authored value. Neither writes or deletes the saved choice. */
export const UNDECIDED_EFFORT_PRECEDENCE = {
    decided: false,
    detail: "Precedence between a seat's saved effort and an older snapshot or a spec refresh is the founder's open decision; until then each keeps its earlier behaviour and nothing deletes the saved choice.",
    restoreLaunchEffort({ snapshot, live }) {
        const effort = snapshot.effort?.trim() || null;
        if (!live?.choice || live.choice === effort)
            return { effort };
        return {
            effort,
            warning: `Effort: this restore launched ${effort ?? "with no effort flag"} from the snapshot, not the seat's saved choice ${live.choice}; which wins is an open decision. The saved choice is kept for the next managed continuation.`,
        };
    },
    specRefreshChoice: () => "keep",
};
/**
 * The decided rule: a seat's latest explicit effort choice sticks until cleared, through reboots, team restarts,
 * restores and spec refreshes; clearing returns to the spec's authored effort or the runtime default, and says
 * which. Fresh launches, successors and in-place restarts already resolve the choice first (resolveSeatEffort);
 * this rule covers the two writers that hold older values:
 * - a snapshot restore launches the seat's saved choice when it has one (saying so when the snapshot held another
 *   value); the restore finds the live seat by its logical id, so a seat grown back under a new node id counts. A
 *   seat without a choice (never set, or cleared) launches the snapshot's authored effort as before, so an older
 *   snapshot never brings a cleared choice back. With no live seat (`live` null), the rule answers with the
 *   snapshot's recorded choice, else its authored effort; that answer is rule-only, since restore doesn't
 *   launch a seat that no longer exists;
 * - a spec refresh rewrites the authored value and keeps the choice.
 * No restore option in this version picks older settings deliberately, so every restore keeps the choice.
 */
export const LATEST_WINS_EFFORT_PRECEDENCE = {
    decided: true,
    detail: "A seat's latest explicit effort choice sticks until cleared, through reboots, team restarts, restores and spec refreshes; clearing returns to the spec's authored effort or the runtime default. No restore option picks older settings, so every restore keeps the choice.",
    restoreLaunchEffort({ snapshot, live }) {
        const snapshotChoice = snapshot.effortChoice?.trim() || null;
        const snapshotEffort = snapshot.effort?.trim() || null;
        if (!live)
            return { effort: snapshotChoice ?? snapshotEffort };
        if (!live.choice)
            return { effort: snapshotEffort };
        const held = snapshotChoice ?? snapshotEffort;
        if (held === live.choice)
            return { effort: live.choice };
        return {
            effort: live.choice,
            warning: `Effort: this restore launched the seat's saved choice ${live.choice}, not ${held ?? "the snapshot's runtime default (no effort flag)"} from the snapshot; the latest explicit choice stays until it is cleared (rig seat set-effort --clear).`,
        };
    },
    specRefreshChoice: () => "keep",
};
export const effortPrecedence = LATEST_WINS_EFFORT_PRECEDENCE;
/** Levels each runtime is known to accept (Codex 0.153.4's service lists these when it rejects one;
 *  Claude Code's --effort levels). A level outside the list is saved with a warning, never refused:
 *  versions and models move, and the runtime's own answer is what the report shows. */
export const KNOWN_EFFORT_LEVELS = {
    codex: ["none", "minimal", "low", "medium", "high", "xhigh", "max"],
    "claude-code": ["low", "medium", "high", "xhigh", "max"],
};
export function unknownLevelWarning(runtime, level) {
    if (level === null || KNOWN_EFFORT_LEVELS[runtime].includes(level))
        return undefined;
    const name = runtime === "codex" ? "Codex" : "Claude Code";
    return `"${level}" isn't a level ${name} is known to accept (${KNOWN_EFFORT_LEVELS[runtime].join(", ")}); the next managed continuation sends it anyway, and the runtime may reject every turn until it is changed.`;
}
/** The effort a launch command line carries. "none": parsed, and it sends no effort flag. */
export function emittedEffortFromArgv(runtime, argv) {
    let found = null;
    for (let index = 1; index < argv.length; index += 1) {
        const arg = argv[index];
        if (runtime === "claude-code") {
            if (arg === "--effort") {
                found = argv[index + 1] ?? null;
                index += 1;
            }
            else if (arg.startsWith("--effort="))
                found = arg.slice("--effort=".length);
        }
        else {
            let config;
            if (arg === "-c" || arg === "--config") {
                config = argv[index + 1];
                index += 1;
            }
            else if (arg.startsWith("--config="))
                config = arg.slice("--config=".length);
            const match = config?.match(/^model_reasoning_effort\s*=\s*(.*)$/);
            if (match)
                found = match[1].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
        }
    }
    return found ? { flag: "present", value: found } : { flag: "none" };
}
const TAIL_BYTES = 4_000_000;
/**
 * The effort the native session recorded for its latest turn since `processStartedAt` (ps lstart):
 * Claude writes it on each assistant entry of its transcript, Codex on each turn_context line of its
 * rollout. A turn before the process started belongs to an earlier launch of the same conversation,
 * so it is never reported as this launch's effort.
 */
export function readNativeEffort(runtime, transcriptPath, processStartedAt) {
    if (!transcriptPath)
        return { state: "not_verified", detail: "The native transcript for this session isn't known to OpenRig." };
    const since = lstartToMinTs(processStartedAt ?? undefined);
    if (since === undefined)
        return { state: "not_verified", detail: "The running process's start time could not be read, so a turn can't be tied to this launch." };
    let text;
    try {
        text = readTail(transcriptPath, TAIL_BYTES);
    }
    catch (error) {
        return { state: "not_verified", detail: `The native transcript could not be read: ${error.message}` };
    }
    const lines = text.split("\n");
    const parse = (line) => {
        try {
            return JSON.parse(line);
        }
        catch {
            return null;
        }
    };
    for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index].trim();
        if (!line.includes("ffort"))
            continue;
        const entry = parse(line);
        if (!entry)
            continue;
        const at = typeof entry["timestamp"] === "string" ? entry["timestamp"] : null;
        let value;
        if (runtime === "claude-code") {
            if (entry["type"] !== "assistant")
                continue;
            value = entry["effort"];
        }
        else {
            if (entry["type"] !== "turn_context")
                continue;
            value = entry["payload"]?.["effort"];
        }
        if (typeof value !== "string" || !value.trim() || !at)
            continue;
        const atMs = Date.parse(at);
        // lstart has one-second resolution: a turn in the launch's own second counts.
        if (Number.isNaN(atMs) || Math.floor(atMs / 1000) < since)
            break;
        if (runtime === "claude-code") {
            return {
                state: "observed", value: value.trim(), at, source: "Claude transcript (latest assistant turn)", outcome: "recorded",
                detail: "Claude recorded this level on an answered turn; whether it is the level after any model fallback isn't shown.",
            };
        }
        const turnId = entry["payload"]?.["turn_id"];
        return { state: "observed", value: value.trim(), at, source: "Codex rollout (latest turn_context)", ...codexTurnOutcome(lines.slice(index + 1), turnId, value.trim(), parse) };
    }
    return { state: "not_verified", detail: "The session has recorded no turn with an effort since this process started; it shows once the seat takes a turn." };
}
/** How the Codex turn that sent the level ended: its task_complete or turn_aborted event, matched by turn id. */
function codexTurnOutcome(after, turnId, level, parse) {
    for (const line of after) {
        if (!line.includes("task_complete") && !line.includes("turn_aborted"))
            continue;
        const payload = parse(line.trim())?.["payload"];
        const type = payload?.["type"];
        if ((type !== "task_complete" && type !== "turn_aborted") || (typeof turnId === "string" && payload["turn_id"] !== turnId))
            continue;
        if (type === "turn_aborted") {
            return { outcome: "interrupted", detail: "The turn was interrupted; it isn't known whether this level was taken." };
        }
        const error = payload["error"];
        if (error) {
            const message = typeof error.message === "string" ? error.message : JSON.stringify(error);
            if (namesRejectedLevel(message, level))
                return { outcome: "rejected", detail: `The service rejected the request: ${message.slice(0, 400)}` };
            return { outcome: "failed", detail: `The turn failed (${errorKind(error.codex_error_info)}) before this level could be judged.` };
        }
        return { outcome: "accepted", detail: "The turn completed without an error, so the Codex service took this level." };
    }
    return { outcome: "pending", detail: "The turn that sent this level hasn't finished." };
}
/** The request rejection Codex's service returns for an unknown effort level (measured on 0.153.4):
 *  "Invalid value: '<level>'. Supported values are: …". Only that, naming this level, is a rejection. */
function namesRejectedLevel(message, level) {
    const named = message.match(/Invalid value: '([^']*)'/);
    return !!named && named[1] === level && /Supported values/.test(message);
}
function errorKind(info) {
    const kind = typeof info === "string" ? info
        : info && typeof info === "object" ? Object.keys(info)[0]
            : undefined;
    return kind === "usage_limit_exceeded" ? "usage limit" : kind === "unauthorized" ? "unauthorized" : kind ? kind.replace(/_/g, " ") : "other";
}
function readTail(filePath, maxBytes) {
    const fd = openSync(filePath, "r");
    try {
        const size = fstatSync(fd).size;
        const length = Math.min(size, maxBytes);
        const buffer = Buffer.alloc(length);
        readSync(fd, buffer, 0, length, size - length);
        return buffer.toString("utf-8");
    }
    finally {
        closeSync(fd);
    }
}
//# sourceMappingURL=seat-effort.js.map