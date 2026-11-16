/**
 * OPR.0.7.0.2 (cost reporting, Pi atom): usage facts from Pi's PERSISTED session entries.
 *
 * Read against Pi 0.87.1 (`@earendil-works/pi-coding-agent`, OpenRig's tested baseline), session format v3.
 * Every entry has `{ type, id, parentId, timestamp }`. The usage-bearing kinds are exactly the ones Pi's own
 * totals count (`core/usage-totals.js` getUsageCostBreakdown):
 *   - `message` with `message.role === "assistant"`: `message.usage` (kept for error and aborted turns too);
 *   - `usage` entries: `usage` (a standalone usage category, with `kind`, `provider`, `model`);
 *   - `message` with `message.role === "toolResult"` and `message.usage`;
 *   - `compaction` and `branch_summary` entries with `usage`.
 * A Pi `Usage` carries `input`, `output`, `cacheRead`, `cacheWrite` and `cost.total`, which is Pi's
 * model-priced estimate from catalog rates (not a provider charge).
 *
 * Live `message_update` usage is cumulative and display-only, so it never comes here: only entries Pi has
 * persisted and returned from `get_entries` do. Each fact is keyed by the Pi session id and the entry id, so the
 * consumer stores it once however often it is fetched again.
 */
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === "string" && v.trim() ? v : null);
/**
 * Where an entry of a forked or branched session belongs. Pi stamps the header and each new entry with the same
 * millisecond clock, and a fork copies entries with their original ids and timestamps, so:
 *   - before the header's time: copied history (inherited); after it: the occupant's own;
 *   - the same millisecond decides nothing by itself (copies and new entries both land there): the parent
 *     session's entry ids decide it when they have been read, and otherwise the entry stays unknown.
 * When the parent's ids are known they are the evidence for every entry; a contradiction is unknown.
 */
function originOf(entryId, timestamp, boundary) {
    if (!boundary)
        return "unknown";
    if (!boundary.parentSession)
        return "own";
    const at = Date.parse(timestamp);
    const created = Date.parse(boundary.createdAt);
    if (Number.isNaN(at) || Number.isNaN(created))
        return "unknown";
    if (boundary.parentEntryIds) {
        if (boundary.parentEntryIds.has(entryId))
            return "inherited";
        return at >= created ? "own" : "unknown";
    }
    return at < created ? "inherited" : at > created ? "own" : "unknown";
}
/** Whether an entry is stamped in the same millisecond as the fork header (the case only the parent's ids decide). */
export function tiesPiForkHeader(timestamp, boundary) {
    if (!boundary?.parentSession)
        return false;
    const at = Date.parse(timestamp);
    return !Number.isNaN(at) && at === Date.parse(boundary.createdAt);
}
/**
 * The usage facts in `entries` (Pi `get_entries` data). An entry whose usage can't be read is counted in
 * `malformed` and skipped; nothing here throws, so a bad entry never blocks the seat's work.
 */
export function extractPiUsageFacts(entries, boundary) {
    const facts = [];
    let malformed = 0;
    for (const raw of entries) {
        if (raw === null || typeof raw !== "object")
            continue;
        const entry = raw;
        const message = entry["message"] && typeof entry["message"] === "object" ? entry["message"] : null;
        let kind = null;
        let usage;
        let provider = null;
        let model = null;
        let usageCategory = null;
        let stopReason = null;
        let api = null;
        let responseId = null;
        if (entry["type"] === "message" && message?.["role"] === "assistant") {
            kind = "assistant";
            usage = message["usage"];
            provider = str(message["provider"]);
            model = str(message["responseModel"]) ?? str(message["model"]);
            stopReason = str(message["stopReason"]);
            api = str(message["api"]);
            responseId = str(message["responseId"]);
        }
        else if (entry["type"] === "usage") {
            kind = "usage";
            usage = entry["usage"];
            provider = str(entry["provider"]);
            model = str(entry["model"]);
            usageCategory = str(entry["kind"]);
        }
        else if (entry["type"] === "message" && message?.["role"] === "toolResult" && message["usage"] !== undefined) {
            kind = "tool_result";
            usage = message["usage"];
        }
        else if ((entry["type"] === "compaction" || entry["type"] === "branch_summary") && entry["usage"] !== undefined) {
            kind = entry["type"];
            usage = entry["usage"];
        }
        if (!kind)
            continue;
        const id = str(entry["id"]);
        const timestamp = str(entry["timestamp"]);
        const u = usage && typeof usage === "object" ? usage : null;
        const input = num(u?.["input"]);
        const output = num(u?.["output"]);
        if (!id || !timestamp || !u || input === null || output === null) {
            malformed += 1;
            continue;
        }
        const cost = u["cost"] && typeof u["cost"] === "object" ? num(u["cost"]["total"]) : null;
        facts.push({
            entryId: id,
            parentEntryId: str(entry["parentId"]),
            entryTimestamp: timestamp,
            kind,
            usageCategory,
            provider,
            model,
            input,
            output,
            cacheRead: num(u["cacheRead"]) ?? 0,
            cacheWrite: num(u["cacheWrite"]) ?? 0,
            costTotal: cost,
            stopReason,
            api,
            responseId,
            origin: originOf(id, timestamp, boundary),
        });
    }
    return { facts, malformed };
}
/** The boundary from a Pi session file's first line (its header). null when it can't be read as one, including a
 *  header that parses but whose creation time isn't a date or whose parentSession isn't a path: origin is then
 *  unknown (kept out of the total), never assumed own. */
export function parsePiSessionHeader(firstLine) {
    try {
        const header = JSON.parse(firstLine);
        if (header === null || typeof header !== "object" || Array.isArray(header))
            return null;
        const h = header;
        if (h["type"] !== "session" || typeof h["timestamp"] !== "string" || Number.isNaN(Date.parse(h["timestamp"])))
            return null;
        const parent = h["parentSession"];
        if (parent !== undefined && parent !== null && str(parent) === null)
            return null;
        return { createdAt: h["timestamp"], parentSession: str(parent) };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=pi-usage-facts.js.map