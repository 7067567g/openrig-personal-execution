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
export type PiUsageFactKind = "assistant" | "usage" | "tool_result" | "compaction" | "branch_summary";
/** Where an entry's spend belongs. A fork or branch copies the source session's entries into a new session
 *  file unchanged (same ids, original timestamps); those are `inherited`. `unknown`: the session header that
 *  tells them apart couldn't be read. */
export type PiUsageOrigin = "own" | "inherited" | "unknown";
export interface PiUsageFact {
    entryId: string;
    parentEntryId: string | null;
    entryTimestamp: string;
    kind: PiUsageFactKind;
    /** A `usage` entry's own category (e.g. "cache_warm"); null otherwise. */
    usageCategory: string | null;
    provider: string | null;
    model: string | null;
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    /** Pi's model-priced estimate (`usage.cost.total`); null when the entry carries no cost (absent, never zero). */
    costTotal: number | null;
    /** An assistant turn's stop reason ("stop", "error", "aborted", ...), kept so error and abort usage is visible. */
    stopReason: string | null;
    /** An assistant turn's Pi API ("openai-completions", "anthropic-messages", ...) and the provider's response id
     *  Pi recorded for it; null otherwise. They tie the turn to a provider's own record of the request. */
    api?: string | null;
    responseId?: string | null;
    origin: PiUsageOrigin;
}
/** The session header boundary that separates inherited entries from the occupant's own. */
export interface PiSessionBoundary {
    /** The session header's creation time. */
    createdAt: string;
    /** Set when the session was forked or branched from another. */
    parentSession: string | null;
    /** The entry ids in the parent session file, when it has been read. A fork or branch copies entries with their
     *  parent ids unchanged, and Pi gives a new entry an id not already in the session, so membership decides. */
    parentEntryIds?: ReadonlySet<string> | null;
}
/** Whether an entry is stamped in the same millisecond as the fork header (the case only the parent's ids decide). */
export declare function tiesPiForkHeader(timestamp: string, boundary: PiSessionBoundary | null): boolean;
/**
 * The usage facts in `entries` (Pi `get_entries` data). An entry whose usage can't be read is counted in
 * `malformed` and skipped; nothing here throws, so a bad entry never blocks the seat's work.
 */
export declare function extractPiUsageFacts(entries: unknown[], boundary: PiSessionBoundary | null): {
    facts: PiUsageFact[];
    malformed: number;
};
/** The boundary from a Pi session file's first line (its header). null when it can't be read as one, including a
 *  header that parses but whose creation time isn't a date or whose parentSession isn't a path: origin is then
 *  unknown (kept out of the total), never assumed own. */
export declare function parsePiSessionHeader(firstLine: string): PiSessionBoundary | null;
//# sourceMappingURL=pi-usage-facts.d.ts.map