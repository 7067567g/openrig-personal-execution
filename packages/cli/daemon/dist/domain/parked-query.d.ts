import type { ArbitratedSeatState, NeedsInput } from "./activity-taxonomy.js";
/** One open obligation row from the queue's obligation face. HELD rows (state=blocked —
 *  the deliberate queue-level hold with an owner and a resolution path) are the
 *  vocabulary's NOT-parked case and are surfaced separately, never counted as
 *  park-driving. */
export interface ObligationRow {
    qitemId: string;
    state: "pending" | "in-progress" | "blocked";
    summary?: string | null;
}
export interface ParkWakeDiagnosis {
    kind: "watchdog" | "timer" | "blocker";
    ref: string;
    live: boolean;
    phase?: "armed" | "fired";
    deliveryStatus?: string | null;
    unconsumed: boolean;
    recoveryOwner?: "queue-stuck-sweep";
    expiresAt?: string;
}
export interface HeldObligation extends ObligationRow {
    state: "blocked";
    wake: ParkWakeDiagnosis | null;
    healthy: boolean;
    /** Present when the row is healthy because its owner's own active repeating reminder keeps waking it. */
    servedByOwnReminder?: true;
}
export interface ObligationRead {
    /** The rows the reader returned (bounded by `limit`). */
    rows: ObligationRow[];
    /** The bound the reader applied — the guard input. */
    limit: number;
}
export interface ParkedQueryDeps {
    getSeatState: (seatNodeId: string) => ArbitratedSeatState | null;
    /** The obligation face, scoped destination + open-state; the query never widens or
     *  narrows this silently — the scope string in the result names exactly what ran. */
    listOpenObligations: (destinationSession: string, limit: number) => ObligationRead;
    /** Optional only for pre-073 fixtures. Missing is honestly wakeless. */
    getParkWake?: (qitemId: string) => unknown;
    /** Whether the row's own owner is still being woken by the active repeating reminder attached to it, and that
     *  reminder's latest delivery reached them. Missing means no such exemption. */
    servedByOwnReminder?: (qitemId: string) => boolean;
}
export interface SeatParkedDiagnosis {
    seatNodeId: string;
    sessionName: string;
    /** true / false, or "indeterminate" when an input cannot support the verdict. */
    parked: boolean | "indeterminate";
    reason: string;
    activity: {
        value: string;
        needsInput: NeedsInput;
        decidedBy: string | null;
        confidence: "oracle" | "unknown";
    };
    obligations: {
        /** The EXACT scope that ran — named, so a false absence is auditable. */
        scope: string;
        openCount: number;
        heldCount: number;
        unhealthyHeldCount: number;
        /** false when returned == limit: the count may be truncated (never silently). */
        complete: boolean;
        limit: number;
        items: ObligationRow[];
        held: HeldObligation[];
    };
    confidence: {
        activity: "high" | "none";
        obligations: "complete" | "truncation-possible" | "unavailable";
    };
}
export interface RigParkedDiagnosis {
    parked: boolean | "indeterminate";
    reason: string;
    seats: SeatParkedDiagnosis[];
}
export declare const PARKED_OBLIGATION_LIMIT = 500;
export declare function diagnoseSeatParked(deps: ParkedQueryDeps, seat: {
    seatNodeId: string;
    sessionName: string;
}): SeatParkedDiagnosis;
export declare function diagnoseRigParked(deps: ParkedQueryDeps, seats: Array<{
    seatNodeId: string;
    sessionName: string;
}>): RigParkedDiagnosis;
//# sourceMappingURL=parked-query.d.ts.map