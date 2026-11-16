// Seat-handover boot recap — the shared provider-JSONL role/content reader. Reads a
// KNOWN provider session-transcript path (claude sidecar `transcript_path` / codex `rollout_path`)
// into the last-N {role, content} exchanges for the successor's boot recap. DEFENSIVE / honest-degraded
// by contract: metadata lines, thinking/tool_use-only messages, and unparseable lines carry no user
// text and are silently skipped; a missing/corrupt file yields [] and NEVER throws (a boot recap must
// never crash the successor). Ownership: dev-planner ruled this the shared parser (their rig-ask L2
// only greps raw lines); it may consume this later if L2 upgrades to structured excerpts.
//
// Grounded at source on the real claude-projects line shape:
//   {type:"user"|"assistant", message:{role, content}} where content is a STRING or an array of
//   {type:"text"|"thinking"|"tool_use", text?} blocks (only "text" carries user-visible content).
// Codex rollout lines use {payload:{type:"message", role, content}} — handled by the same reader.
import { existsSync, readFileSync } from "node:fs";
/** Extract the user-visible text from a message `content` field (string, or an array of blocks —
 *  join `text` blocks, plus Codex input_text/output_text when requested; skip thinking/tool_use). Returns "" when there is no text. */
function extractText(content, codex = false) {
    if (typeof content === "string")
        return content;
    if (Array.isArray(content)) {
        return content
            .filter((block) => {
            if (!block || typeof block !== "object")
                return false;
            const { type, text } = block;
            const visible = type === "text" || (codex && (type === "input_text" || type === "output_text"));
            return visible && typeof text === "string";
        })
            .map((b) => b.text)
            .join("\n");
    }
    return "";
}
/** Interpret ONE parsed JSONL object as an exchange, or null if it carries no user-visible message
 *  (metadata, thinking/tool_use-only, unrecognized shape). */
function toExchange(obj) {
    if (!obj || typeof obj !== "object")
        return null;
    const o = obj;
    // claude-projects: {type:"user"|"assistant", message:{role, content}}
    const msg = o.message;
    if (msg && typeof msg.role === "string") {
        const content = extractText(msg.content);
        return content.length > 0 ? { role: msg.role, content } : null;
    }
    // codex rollout: {payload:{type:"message", role, content}}
    const payload = o.payload;
    if (payload && payload.type === "message" && typeof payload.role === "string") {
        const content = extractText(payload.content, true);
        return content.length > 0 ? { role: payload.role, content } : null;
    }
    return null;
}
/**
 * Parse a provider session JSONL at `path` into the LAST `n` {role, content} exchanges (bounded recap).
 * Honest-degraded: missing/unreadable file → []; unparseable/metadata/text-less lines are skipped.
 */
export function parseJsonlExchanges(path, n) {
    if (!existsSync(path))
        return [];
    let raw;
    try {
        raw = readFileSync(path, "utf8");
    }
    catch {
        return [];
    }
    const exchanges = [];
    for (const line of raw.split("\n")) {
        if (line.trim().length === 0)
            continue;
        let obj;
        try {
            obj = JSON.parse(line);
        }
        catch {
            continue; // corrupt line — skip, never throw
        }
        const ex = toExchange(obj);
        if (ex)
            exchanges.push(ex);
    }
    return n >= exchanges.length ? exchanges : exchanges.slice(exchanges.length - n);
}
//# sourceMappingURL=session-jsonl.js.map