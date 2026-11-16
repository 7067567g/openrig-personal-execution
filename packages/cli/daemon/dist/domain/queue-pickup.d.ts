export declare const PICKUP_STALL_THRESHOLD_KEY = "queue.pickup_stall_threshold_minutes";
export declare const DEFAULT_PICKUP_STALL_THRESHOLD_MINUTES = 3;
export interface PickupReceipt {
    state: "unclaimed" | "working" | "stalled-after-claim" | "parked" | "terminal";
    /** Present iff stalled or terminal: the named evidence replacing the manual cross-surface join. */
    evidence?: string;
}
/** Threshold, FRESH-READ per call (the terminal.status_bar precedent: a config flip applies
 *  to the next read, no restart). Fail-open to the default on any resolution error. */
export declare function resolvePickupThresholdMinutes(): number;
export interface PickupFacts {
    state: string;
    claimedAt: string | null | undefined;
    lastHeartbeat: string | null | undefined;
    /** Count of transitions strictly after the claim, excluding the claim's own transition. */
    postClaimMotionCount: number;
    lastMeaningfulAt?: string;
    activity?: string;
    needsInput?: number;
    now?: Date;
    thresholdMinutes?: number;
}
/** The ONE derivation rule — every projection surface (rowToItem, the pickup view lens, the
 *  S02 finding input) calls this same function, so the rule cannot drift between surfaces. */
export declare function derivePickup(facts: PickupFacts): PickupReceipt;
/** S02 INPUT CONTRACT — the finding shape the standing sweep consumes (routed to the claimant
 *  first, then its orchestrator — the ROUTING is S02's; this is a pure library shape, no loop,
 *  no scheduler). Returns null for anything not stalled. */
export interface StalledPickupFinding {
    kind: "stalled-after-claim";
    /** The claimant (the row's destination — the seat that claimed and went quiet). */
    target: string;
    qitemId: string;
    evidence: string;
}
export declare function stalledPickupFinding(item: {
    qitemId: string;
    destinationSession?: string | null;
    pickup?: PickupReceipt;
}): StalledPickupFinding | null;
//# sourceMappingURL=queue-pickup.d.ts.map