export interface OneClickRigInput {
    rigName: string;
    seatCount: number;
    resumableCount: number;
}
/** A rig that is NOT fully resumable — the seats that would be fresh-primed/awaiting-decision. */
export interface OneClickDelta {
    rigName: string;
    seatCount: number;
    resumableCount: number;
    nonResumable: number;
}
export interface OneClickGate {
    /** True ⇒ ⏎ RESTORE EVERYTHING is a single keystroke (no confirm). */
    zeroGeneration: boolean;
    /** Rigs with non-resumable seats — the confirm screen names exactly these. Empty ⇔ zeroGeneration. */
    deltas: OneClickDelta[];
}
/** The confirm-screen message for a non-zero-generation restore. TRUTHFUL (r2 HIGH-2): the restore
 *  does NOT auto-fresh-prime — non-resumable seats land in the triage list AWAITING A DECISION
 *  (fresh-prime or skip). It NAMES the deltas (R7: no silent resume→fresh downgrade) and describes the
 *  decision that follows; it never promises an action the restore doesn't request. */
export declare function restoreConfirmMessage(deltas: OneClickDelta[]): string;
/** Evaluate the one-click gate over the C2 discovery's per-rig resumable/seat counts. */
export declare function evaluateOneClickGate(discovery: {
    foundOnHost: OneClickRigInput[];
}): OneClickGate;
//# sourceMappingURL=one-click-gate.d.ts.map