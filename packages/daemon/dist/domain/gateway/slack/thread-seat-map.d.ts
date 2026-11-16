import type Database from "better-sqlite3";
export interface ThreadMapping {
    threadTs: string;
    channel: string;
    human: string;
    seat: string;
    conversationId: string;
    state: "open" | "closed";
    openedAt: string;
    closedAt?: string | null;
}
export declare const SLACK_POSTED_STAMP_PREFIX = "slack-posted";
/** The structured queue-row stamp for a posted thread root (the rebuild source). */
export declare function formatPostedStamp(m: {
    threadTs: string;
    messageTs: string;
    channel: string;
    human: string;
    seat: string;
    conversationId: string;
}): string;
/** Parse a posted stamp (null when the note is not one). Field order is not significant. */
export declare function parsePostedStamp(note: string): {
    threadTs: string;
    messageTs: string;
    channel: string;
    human: string;
    seat: string;
    conversationId: string;
} | null;
export declare class ThreadSeatMap {
    private readonly db;
    private readonly now;
    constructor(db: Database.Database, now?: () => Date);
    /** Record a NEW thread root (idempotent on thread_ts — a replayed root keeps one row). */
    open(m: {
        threadTs: string;
        channel: string;
        human: string;
        seat: string;
        conversationId: string;
    }): void;
    /** Deterministic inbound lookup: the mapping for a thread root, open OR closed (a closed
     *  thread still routes to exactly its mapped seat — the class receipt), or null = UNMAPPED. */
    resolveByThread(threadTs: string): ThreadMapping | null;
    /** Outbound thread reuse: the OPEN conversation for (human, seat), newest first. */
    resolveOpenForPair(human: string, seat: string): ThreadMapping | null;
    /** Outbound reply correlation is qitem-scoped. Reuse a thread only for another
     * notification episode of the SAME durable conversation; a different human
     * gate gets a fresh root so its reply cannot resolve an older/newer qitem. */
    resolveOpenForConversation(human: string, seat: string, conversationId: string): ThreadMapping | null;
    /** #96: the root a conversation opened, open OR closed (the caller decides whether a
     *  closed root may be reused), newest first; null = the conversation never posted a root. */
    resolveByConversation(conversationId: string): ThreadMapping | null;
    /** #899 — record a message OpenRig posted into a thread for an ask, with that ask and its seat (idempotent). */
    recordPart(m: {
        messageTs: string;
        channel: string;
        threadTs: string;
        seat: string;
        conversationId: string;
    }): void;
    /** #899 — the ask and seat of a message OpenRig posted into a thread in this channel; null for any other message. */
    partOf(messageTs: string, channel: string): {
        threadTs: string;
        seat: string;
        conversationId: string;
    } | null;
    close(threadTs: string): void;
    /** Rebuild the table from queue-row stamps (the durable source): INSERT-only, never
     *  overwriting a live row — the map converges toward the stamps without destroying state. */
    rebuildFromStamps(stamps: string[]): {
        inserted: number;
        skipped: number;
    };
}
//# sourceMappingURL=thread-seat-map.d.ts.map