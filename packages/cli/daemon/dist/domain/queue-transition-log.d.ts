import type Database from "better-sqlite3";
import type { ClosureReason } from "./hot-potato-enforcer.js";
export declare const OWNER_NOTIFICATION_LEVELS: readonly ["RECORD", "NOTICE", "ALERT"];
export type OwnerNotificationLevel = (typeof OWNER_NOTIFICATION_LEVELS)[number];
export declare function ownerNotificationLevelAtLeast(level: OwnerNotificationLevel, minimum: OwnerNotificationLevel): boolean;
export interface QueueTransition {
    transitionId: number;
    qitemId: string;
    ts: string;
    state: string;
    transitionNote: string | null;
    actorSession: string;
    closureReason: ClosureReason | null;
    closureTarget: string | null;
    /** P21 §4 era-stamp: how actorSession was established. `transport:v1` = derived from the
     *  transport chokepoint; null/absent = claimed-era (pre-verification), never re-labeled. */
    identityProvenance: string | null;
    ownerNotificationKind: string | null;
    ownerNotificationLevel: OwnerNotificationLevel;
}
export interface QueueTransitionInput {
    qitemId: string;
    state: string;
    actorSession: string;
    transitionNote?: string;
    closureReason?: ClosureReason;
    closureTarget?: string;
    /** P21 §4 era-stamp: the route passes `transport:v1` when actorSession came from the transport
     *  header chokepoint; omit (null) for system/claimed-era transitions — absence is the marker. */
    identityProvenance?: string | null;
    ownerNotificationKind?: string | null;
    ownerNotificationLevel?: OwnerNotificationLevel | null;
}
export type RecentQueueTransitionTargetKind = "qitem" | "slice" | "mission";
export type RecentQueueTransitionScope = {
    kind: "instance";
} | {
    kind: "rig";
    rig: string;
};
/** A compact product event derived only from typed queue state and closure fields.
 * The authored queue summary is presentation only; it never participates in
 * event normalization. transition_note and body remain excluded from event
 * semantics so prose cannot silently become one; `bodyPreview` below is display text only. */
export interface RecentQueueTransition {
    transitionId: number;
    qitemId: string;
    ts: string;
    actorSession: string;
    change: string;
    /** The authored queue summary, trimmed; null when the row has none. Never filled with derived text. */
    summary: string | null;
    /** Display text derived from the body, only for a row with no authored summary (null otherwise).
     * It is the first non-blank line within the first 2,000 characters of the body, trimmed and cut to at
     * most 240 code points (the last three being "..." when cut). It is null when the summary is
     * present, the body is empty, or no non-blank line occurs within those 2,000 characters. SQLite's text
     * substr stops at an embedded NUL, so the line also ends there, and a NUL before any text gives null. */
    bodyPreview: string | null;
    rig: string;
    targetKind: RecentQueueTransitionTargetKind;
    target: string;
}
export declare class QueueTransitionLog {
    readonly db: Database.Database;
    /** P21 §4: detected once — a curated-migration test DB (or a pre-067 daemon) may lack the
     *  era-stamp column, so the writer degrades (omits it) instead of throwing. */
    private readonly hasIdentityProvenanceColumn;
    private readonly hasOwnerNotificationColumns;
    private readonly historySource;
    /** The history tables this schema has: the live table, and the archive where it exists. */
    private readonly historyTables;
    constructor(db: Database.Database);
    /**
     * Append a transition. Designed to be called inside an outer caller-managed
     * `db.transaction()` so the transition row is atomic with the queue_items
     * UPDATE that produced it.
     */
    append(input: QueueTransitionInput): QueueTransition;
    listForQitem(qitemId: string): QueueTransition[];
    /**
     * OPR.0.7.0.12 — the continuation `rig queue block --continuation` recorded for the row's
     * CURRENT park. The current park is the trailing run of `blocked` transitions: the daemon
     * appends its own later blocked transitions (e.g. "parked-owner episode closed"), so the latest
     * one is not the park, and an earlier park's plan must never resurface.
     *
     * One newest-first seek on idx_queue_transitions_qitem_id_order (migration 098) that stops at
     * the first non-blocked transition, so the work is bounded by the current park, not the row's
     * history. The marker match is exact-case, as `rig queue block` writes it. The live table
     * suffices: retention archives only terminal rows, and a parked row is not terminal.
     */
    currentParkContinuation(qitemId: string): string | null;
    /** Bounded source adapter: apply the time window and limit before materializing rows. */
    listForQitemWindow(qitemId: string, startedAt: string, endedAt: string, limit: number): QueueTransition[];
    /** Follow declared handoffs only. Bound the family before materializing its
     * transitions; cycles converge through UNION, and overflow refuses explicitly. */
    listForHandoffWindow(qitemId: string, startedAt: string, endedAt: string, limit: number): QueueTransition[];
    listForActor(actorSession: string, limit?: number): QueueTransition[];
    /** Latest high-signal transitions for one topology scope, returned chronologically with
     * newest last. The window function observes the complete per-qitem state
     * sequence before the allowlist is applied, so note-only same-state writes
     * cannot masquerade as claims, resumes, or blocks. */
    listRecent(scope: RecentQueueTransitionScope, requestedLimit?: number): RecentQueueTransition[];
    /** The newest `limit` qualifying in-scope transitions, newest first. The scope's items are resolved
     * once; live and archived history is then walked newest-first in (ts, transition_id) order on an
     * index that carries qitem_id, so a transition outside the scope is rejected from its index entry
     * without reading its row, and the walk stops at the limit. A candidate's predecessor is the same
     * item's greatest earlier transition_id across both tables: the value LAG over the item's full
     * history gave, so a same-state note never qualifies. */
    private newestQualifying;
    listRecentForRig(rig: string, requestedLimit?: number): RecentQueueTransition[];
    latestOwnerNotificationForQitem(qitemId: string): QueueTransition | null;
    private ownerNotificationsStatement?;
    /** The owner notifications a delivery ledger reads, by qitem, newest first: a qitem's latest (the first,
     *  latestOwnerNotificationForQitem's), and its latest outbound one (a kind other than human-decision-resolved) when
     *  that is older. One read for a whole listing. */
    ownerNotificationsForQitems(qitemIds: readonly string[]): Map<string, QueueTransition[]>;
    hasOwnerNotificationReceipt(qitemId: string, notificationKey: string): boolean;
    private rowToTransition;
}
//# sourceMappingURL=queue-transition-log.d.ts.map