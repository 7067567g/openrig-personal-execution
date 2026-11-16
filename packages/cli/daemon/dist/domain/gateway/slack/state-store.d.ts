export interface StateFsOps {
    readFileSync(p: string): string;
    appendFileSync(p: string, data: string): void;
    writeFileSync(p: string, data: string): void;
    rename(from: string, to: string): void;
    mkdirp(dir: string): void;
}
export declare const nodeStateFs: StateFsOps;
export interface SeenRecord {
    id: string;
    ts: string;
    status: string;
}
/**
 * Delivery-dedup log. `load()` reads the durable set from disk; `mark()` appends
 * AFTER the guarded side effect. Idempotent on id: a repeated id collapses in
 * `load()`'s Set, and callers gate the side effect on `!seen.has(id)` so a
 * duplicate is never re-delivered within a run.
 */
export declare class SeenStore {
    private readonly file;
    private readonly fsops;
    private readonly now;
    constructor(file: string, fsops?: StateFsOps, now?: () => Date);
    load(): Set<string>;
    /** Append a seen record. MUST be called only after the guarded side effect succeeds. */
    mark(id: string, status: string): void;
    /**
     * Seed existing ids as already-seen WITHOUT triggering the side effect
     * (locked item 9: enable-time backlog seeds as history, zero replay storm).
     */
    seed(ids: string[], status?: string): number;
}
export interface DeadLetterEntry<T = unknown> {
    ev: T;
    at: string;
    attempts: number;
}
/**
 * Inbound never-drop net. Every event that fails to land is appended
 * (attempt-counted) BEFORE the error path returns.
 *
 * INTERRUPTION-SAFE retry (the B2 fix): retry does NOT truncate first. The
 * caller `readAll()`s (non-destructive), attempts each, then `replaceAll()`s the
 * file with ONLY the still-failing entries via an atomic temp-write + rename. So
 * the durable file always reflects the unrecovered set: a crash at ANY point
 * before the rename leaves the ORIGINAL file fully intact (at-least-once — a
 * since-landed event is skipped on re-read via the seen-set, so not even a dup).
 * There is no truncate-before-success window.
 */
export declare class DeadLetterStore<T = unknown> {
    private readonly file;
    private readonly fsops;
    private readonly now;
    constructor(file: string, fsops?: StateFsOps, now?: () => Date);
    append(ev: T, attempts: number): void;
    /** Non-destructive read of all durable entries. */
    readAll(): DeadLetterEntry<T>[];
    /** Non-destructive read that keeps an ABSENT file apart from an UNREADABLE one.
     *  A caller that surfaces a count must not report a false zero when the file
     *  exists but could not be read: absent is a real empty set, any other error is
     *  a named read failure. */
    readResult(): {
        ok: true;
        entries: DeadLetterEntry<T>[];
    } | {
        ok: false;
        reason: string;
    };
    /** Atomically replace the durable set (temp-write + rename). Used after a retry pass. */
    replaceAll(entries: DeadLetterEntry<T>[]): void;
    /** Finish a retry snapshot without removing entries appended while it awaited I/O.
     * Match occurrences, not just event ids: a later identical append is still owed. */
    replaceBatch(processed: DeadLetterEntry<T>[], remaining: DeadLetterEntry<T>[]): void;
}
export type InboundReceiptStatus = "connect-attempt" | "connected" | "disconnected" | "connect-failed" | "received" | "accepted" | "ignored" | "refused" | "dead-lettered" | "handler-failed" | "replace-requested";
export interface InboundReceipt {
    at: string;
    generation: number;
    status: InboundReceiptStatus;
    envelopeId?: string;
    eventTs?: string;
    channel?: string;
    reason?: string;
    /** Slack's `hello` count of this app's open Socket Mode connections. */
    connections?: number;
}
/** Credential-free ingress/lifecycle ledger. A received receipt is appended before
 * handler filtering, then a final typed disposition follows. It deliberately has no
 * message body, sender, token, or secret fields. */
export declare class InboundReceiptStore {
    private readonly file;
    private readonly fsops;
    private readonly now;
    constructor(file: string, fsops?: StateFsOps, now?: () => Date);
    append(receipt: Omit<InboundReceipt, "at">): void;
    readAll(): InboundReceipt[];
}
/** Slack timestamps are decimal seconds with up to six fractional digits, not floats. */
export declare function slackMicros(value: unknown): bigint | null;
export declare function slackTimestamp(micros: bigint): string;
export interface ChannelCoverage {
    coverageStart: string;
    coveredThrough: string;
    seedBasis: "newest-durable-landing" | "feature-adoption";
    pending?: {
        upper: string;
        nextLatest: string;
    };
    nextRetryAt?: number;
    /** Available history was scanned, but Slack reported older history beyond its plan limit. */
    historyLimited?: boolean;
}
/** A scan boundary, not an event receipt. Status uses an in-memory snapshot, never this file. */
export declare class ChannelCoverageStore {
    private readonly file;
    private readonly fsops;
    constructor(file: string, fsops?: StateFsOps);
    private read;
    save(channel: string, coverage: ChannelCoverage): void;
    initialize(channel: string, at: string, seenFile: string, receiptsFile: string): ChannelCoverage;
}
//# sourceMappingURL=state-store.d.ts.map