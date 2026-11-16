export interface DeadlineInstanceView {
    instanceId: string;
    status: string;
    currentFrontier: string[];
    currentStepId: string | null;
}
export interface DeadlinePacketView {
    qitemId: string;
    state: string;
    destinationSession: string;
    tsCreated: string;
    claimedAt: string | null;
    closureRequiredAt: string | null;
}
/**
 * THE single threshold home (arch gate-leg ruling: EXPORTED, documented
 * as the one place this number lives — WF-5's class-(b) stuck/overdue
 * thresholds bind to this constant by ruling; they never redefine it).
 *
 * Derivation: the shipped routine-tier SLA (TIER_SLA_SECONDS.routine =
 * 4h in hot-potato-enforcer.ts — module-private there, so the value is
 * restated rather than imported; the derivation is this sentence).
 * Workflow step packets carry tier "mode2" with no SLA entry, so this
 * constant is the effective deadline for both unclaimed anchors and
 * the claimed-null-deadline anchor.
 */
export declare const WORKFLOW_STEP_STUCK_THRESHOLD_SECONDS: number;
export type WorkflowStepDeadlineState = "healthy" | "overdue-claimed" | "overdue-unclaimed";
export interface WorkflowStepDeadlineEvidence {
    instanceId: string;
    /** The instance's durable current step binding (may be null pre-R2). */
    stepId: string | null;
    packetId: string;
    ownerSession: string;
    packetState: string;
    /** Which anchor classified this packet (the JSDoc classification). */
    anchor: "closure_required_at" | "claimed_at" | "created_at";
    /** ISO timestamp the anchor points at (deadline or anchor start). */
    anchorAt: string;
    /** Seconds past the effective deadline (>= 0 when overdue). */
    overdueBySeconds: number;
    /** Age of the packet since creation, seconds. */
    ageSeconds: number;
    /** claimed_at when the row still carries it (sub-states 1/2). */
    claimedAt: string | null;
}
export interface WorkflowDeadlineVerdict {
    state: WorkflowStepDeadlineState;
    /** Present iff state != healthy. */
    evidence: WorkflowStepDeadlineEvidence | null;
}
/**
 * Evaluate one instance's frontier against the deadline model. Pure:
 * (instance, packets, now) -> verdict. `packets` are the queue rows
 * for instance.currentFrontier (missing rows are ignored — a frontier
 * id that no longer resolves is a different corruption class, guarded
 * elsewhere).
 *
 * Only `active` and `waiting` instances can be overdue; terminal
 * instances are always healthy (nothing to nudge).
 */
export declare function evaluateStepDeadline(instance: DeadlineInstanceView, packets: Array<DeadlinePacketView | null | undefined>, now: Date): WorkflowDeadlineVerdict;
/**
 * FR-6 (G4) helper: the max_hops comparison, structured against an
 * EFFECTIVE BASELINE (arch N1 ruling). v1 pins baseline = 0
 * (MAX_HOPS_BASELINE_V1); WF-5 FR-4's resume later amends the baseline
 * so each redrive gets one bounded window — this helper is the seam,
 * never hard-welded to lifetime-total.
 *
 * Returns true when executing ONE MORE hop would exceed the guard.
 */
export declare const MAX_HOPS_BASELINE_V1 = 0;
export declare function exceedsMaxHops(hopCount: number, baseline: number, maxHops: number | undefined): boolean;
//# sourceMappingURL=workflow-deadline.d.ts.map