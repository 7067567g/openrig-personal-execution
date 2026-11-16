import type Database from "better-sqlite3";
import type { ArbitratedSeatState } from "./activity-taxonomy.js";
export type WaitingActivityReader = (session: string) => Pick<ArbitratedSeatState, "activity" | "needsInput" | "decidedBy"> | null;
/** A read of the existing transition log, not another progress receipt. Machine
 * actors and typed wake receipts are bookkeeping, never task progress. Historical
 * untyped author notes remain author testimony; their text is not classified.
 * Delivery bookkeeping uses the reserved daemon actors and must not reset the
 * ladder before it can join its dispatch marker to the delivery receipt. */
export declare function lastMeaningfulTransition(db: Database.Database, id: string): {
    id: number;
    at: string;
} | null;
/** Grace starts when a row becomes actionable again, not at its birth before a
 * long healthy park. Same-state notes and deliveries cannot move this boundary. */
export declare function pendingSince(db: Database.Database, id: string): string | null;
export interface WaitingView {
    obligation: string;
    owner: string;
    state: string;
    actionableSince: string | null;
    blocker: {
        ref: string;
        owner: string | null;
        state: string | null;
    } | null;
    lastMeaningfulChange: {
        id: number;
        at: string;
    } | null;
    liveness: {
        subject: string;
        activity: string;
        needsInput: {
            count: number;
            reason: string | null;
        };
        confidence: "oracle" | "unknown";
    };
    nextBackstop: {
        owner: string;
        mechanism: string;
        dueAt: string | null;
        intervalSeconds: number | null;
        suspendedUntil?: string;
        recovery?: {
            qitemId: string;
            state: string;
        };
        note?: string;
    };
    /** Conditional later safety net, retained when delivery/recovery owns the next action. */
    laterBackstop?: WaitingView["nextBackstop"];
    deadlineAt: string | null;
    attention?: {
        scope: string;
        revision: string;
        source: "last observed by wait timer";
    };
}
export declare function readWaitingView(db: Database.Database, id: string, readActivity?: WaitingActivityReader): WaitingView | null;
//# sourceMappingURL=queue-waiting.d.ts.map