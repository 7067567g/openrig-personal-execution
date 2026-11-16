import type Database from "better-sqlite3";
/**
 * The EXECUTABLE wake-intent namespace. A durable wake intent is written by the
 * daemon (QueueRepository.stageWakeIntent) with an id under this prefix, and the
 * startup drain EXECUTES every pending row under it as a real wake.
 *
 * NOT a route reservation: the public `/outbox/record` audit route no longer
 * refuses caller-supplied ids under this prefix (the W4-era MF5 guard was unbuilt —
 * founder ruling, over-engineering audit: its justification required an adversary
 * inside this trust domain, where the only caller is the daemon's own localhost
 * client). A caller CAN now record an id under this prefix and the drain will
 * select it. Single source of truth for the drain query only.
 */
export declare const WAKE_INTENT_PREFIX = "wake-intent-";
export declare const OUTBOX_DELIVERY_STATES: readonly ["pending", "sending", "delivered", "failed", "indeterminate", "retained", "retired"];
export type OutboxDeliveryState = (typeof OUTBOX_DELIVERY_STATES)[number];
/**
 * Validate a raw `delivery_state` cell against the closed union before it is typed
 * as an {@link OutboxDeliveryState}. Replaces the prior unchecked `as` cast: a cast
 * never fails, so a stray DB value (corruption, a newer daemon's state read by an
 * older one) would silently masquerade as a typed value and make every downstream
 * narrowing unsound. We control every writer, so an unknown value is a real defect —
 * fail loud rather than fabricate a type.
 */
export declare function parseDeliveryState(raw: string): OutboxDeliveryState;
export interface OutboxEntry {
    outboxId: string;
    senderSession: string;
    destinationSession: string;
    body: string;
    tags: string[] | null;
    urgency: string;
    tsDispatched: string;
    deliveryState: OutboxDeliveryState;
    deliveredAt: string | null;
    auditPointer: string | null;
    guardBinding?: {
        nodeId: string;
        session: string;
        occupant: string | null;
        pane: string | null;
    } | null;
    retiredAt?: string | null;
    retiredBy?: string | null;
    retirementReason?: string | null;
}
export interface OutboxRecordInput {
    outboxId?: string;
    senderSession: string;
    destinationSession: string;
    body: string;
    tags?: string[];
    urgency?: string;
    auditPointer?: string;
    /** P21 §4 era-stamp: the route passes `transport:v1` (senderSession derived from the transport
     *  header chokepoint). Written onto the outbox row; absence = claimed-era. */
    identityProvenance?: string | null;
}
export declare class OutboxHandlerError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/**
 * Sender-side outbox. Symmetric to InboxHandler. Records what a sender
 * dispatched independent of receiver behavior. Idempotent on outbox_id.
 *
 * No event-bus events emitted in Phase A — outbox is pure audit. If a future
 * phase wants delivery-tracking events, add them through this surface.
 */
export declare class OutboxHandler {
    readonly db: Database.Database;
    /** P21 §4: detected once — a curated-migration test DB (or a pre-067 daemon) may lack the
     *  era-stamp column, so the writer degrades (omits it) instead of throwing. */
    private readonly hasIdentityProvenanceColumn;
    constructor(db: Database.Database);
    record(input: OutboxRecordInput): OutboxEntry;
    /** Retention shares the existing outbox ID. Committed wakes preserve each member,
     * even if guard activation happened after staging and quota is now exhausted. */
    retain(input: OutboxRecordInput & {
        outboxId: string;
    }, binding: NonNullable<OutboxEntry["guardBinding"]>, precommitted?: boolean): OutboxEntry;
    assertRetentionCapacity(nodeId: string, body: string): void;
    retire(outboxId: string, actor: string, reason: string): OutboxEntry;
    heldForNode(nodeId: string, limit?: number, offset?: number): {
        items: OutboxEntry[];
        total: number;
        limit: number;
        offset: number;
        truncated: boolean;
    };
    markDelivered(outboxId: string): OutboxEntry;
    markFailed(outboxId: string): OutboxEntry;
    /**
     * W1 (transactional closure): record an AMBIGUOUS delivery outcome — the send
     * landed but its render could not be confirmed (transport res.ok && !verified).
     * Same compare-and-set shape as markFailed/markDelivered (guards on 'pending'),
     * so it is idempotent and NEVER clobbers a row that already resolved. An
     * indeterminate row is terminal-by-CAS: it is never silently promoted to
     * delivered nor demoted to failed by the drain.
     */
    markIndeterminate(outboxId: string): OutboxEntry;
    /**
     * MF3: atomically CLAIM a pending wake intent for delivery (pending→sending)
     * BEFORE the external send. Returns true iff this caller won the claim. An
     * overlapping drainer's claim finds the row no longer `pending` and returns
     * false, so exactly one caller performs the external send.
     */
    claimForDelivery(outboxId: string): boolean;
    /**
     * MF3: finalize a CLAIMED wake intent (sending→delivered|indeterminate|failed)
     * after its external send resolved. CAS-guarded on `sending` so it only ever
     * finalizes a row this drainer claimed. `delivered_at` is stamped only for a
     * confirmed delivery.
     */
    finalizeDelivery(outboxId: string, state: "delivered" | "indeterminate" | "failed" | "retained"): OutboxEntry;
    getById(outboxId: string): OutboxEntry | null;
    listForSender(senderSession: string, limit?: number): OutboxEntry[];
    /**
     * W1 (transactional closure): list still-`pending` rows whose outbox_id begins
     * with `idPrefix`, oldest first. The drain uses this to recover intents a crash
     * left committed-but-undelivered. `idPrefix` is a trusted compile-time constant
     * (e.g. "wake-intent-") with no LIKE wildcards. Oldest-first + bounded `limit`
     * so a caller can page and terminate on a served short batch (never a silent cap).
     */
    listPending(idPrefix: string, limit?: number): OutboxEntry[];
    /**
     * BLOCKING 1 (guard re-seal): at a process/recovery boundary, atomically
     * reconcile ABANDONED claims — rows a crashed process left in the transient
     * `sending` state — to `indeterminate` WITHOUT re-sending. A `sending` row is
     * ambiguous (the external send may or may not have landed after the claim), so
     * it records `indeterminate`, never a forever-transient claim and never a blind
     * re-send. EXACT-CASE prefix, matching the executable selector. Returns the
     * count reconciled.
     */
    reconcileAbandonedSending(idPrefix: string): number;
    private getByIdRaw;
    private getByIdOrThrow;
    private rowToEntry;
}
//# sourceMappingURL=outbox-handler.d.ts.map