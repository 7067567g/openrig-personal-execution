import type Database from "better-sqlite3";
import type { RigEvent, PersistedEvent } from "./types.js";
type Subscriber = (event: PersistedEvent) => void;
declare const notifyTokenBrand: unique symbol;
export type NotifyToken = PersistedEvent & {
    readonly [notifyTokenBrand]: true;
};
export type NotifyRegister = (token: PersistedEvent) => void;
export interface NotifyDrainStatus {
    state: "healthy" | "unparseable";
    watermark: number;
    lastPoison: {
        seq: number;
        error: string;
        payloadSha: string;
    } | null;
}
export declare class NotifyEnvelopeError extends Error {
    readonly code: "notify_registration_mismatch" | "nested_notify_envelope";
    constructor(code: NotifyEnvelopeError["code"], message: string);
}
export declare class EventBus {
    private subscribers;
    private activeEnvelope;
    private drainingNotifyRows;
    private notifyingSubscribers;
    private notifyEnvelopeRuns;
    private notifyDrainStatus;
    readonly db: Database.Database;
    get subscriberCount(): number;
    constructor(db: Database.Database);
    /**
     * Persist an event and notify subscribers. Use this for standalone emit
     * outside of a caller-managed transaction.
     */
    emit(event: RigEvent): PersistedEvent;
    /**
     * Insert an event row into the events table and return a PersistedEvent.
     * Call this inside a caller-managed db.transaction() so the event insert
     * is atomic with other writes (e.g., session + binding + event in one txn).
     * Does NOT notify subscribers. A notify envelope drains after commit;
     * legacy single-event callers retain their explicit post-commit notify.
     */
    persistWithinTransaction(event: RigEvent): NotifyToken;
    /**
     * Register an exact token from a nested transactional writer with the
     * caller's active notify envelope. Returns false outside an envelope so the
     * same writer can collect the token for legacy post-commit notification.
     */
    registerPersistedWithinActiveEnvelope(token: PersistedEvent): boolean;
    /**
     * Run one caller-owned synchronous transaction under the W2b notification
     * envelope. Every token persisted through EventBus during the callback must
     * be registered before it returns. The exact object-identity sets are
     * compared before commit; committed rows are then delivered from the log.
     */
    withNotifyEnvelope<T>(callback: (register: NotifyRegister) => T): T;
    getNotifyDrainStatus(): NotifyDrainStatus;
    assertNotifyEnvelopeExercised(): void;
    /**
     * Fan out a persisted event to in-memory subscribers.
     * Does NOT insert into DB. Subscriber errors are isolated.
     */
    notifySubscribers(event: PersistedEvent): void;
    subscribe(cb: Subscriber): () => void;
    replaySince(seq: number, rigId: string): PersistedEvent[];
    replayAll(seq: number): PersistedEvent[];
    private pageStatements?;
    /** Up to `limit` events after `seq` and up to `upTo`, oldest first, of one rig when `rigId` is given: a replay read a
     *  page at a time, which events stored meanwhile never lengthen. */
    replayPage(seq: number, upTo: number, limit: number, rigId?: string): PersistedEvent[];
    /** The seq after which the newest `count` events start (of one rig when `rigId` is given): 0 when there are no more
     *  than `count`, the newest seq for 0. A count past a safe integer is more than any log holds: never an OFFSET SQLite
     *  cannot take. */
    seqBeforeNewest(count: number, rigId?: string): number;
    private drainNotifyRowsToQuiescence;
    /** The newest stored event's seq, 0 for an empty log. */
    maxSeq(): number;
    private rowsAfter;
    private rowToPersistedEvent;
}
export {};
//# sourceMappingURL=event-bus.d.ts.map