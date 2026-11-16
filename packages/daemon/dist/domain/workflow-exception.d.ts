import type { WorkflowDeadlineVerdict, WorkflowStepDeadlineEvidence } from "./workflow-deadline.js";
import type { WorkflowInstance } from "./workflow-types.js";
export declare const WORKFLOW_EXCEPTION_CLASSES: readonly ["unmapped_failed", "stuck_overdue", "human_gate_trip"];
export type WorkflowExceptionClass = (typeof WORKFLOW_EXCEPTION_CLASSES)[number];
/**
 * THE OCCURRENCE DEFINITION (the single home — every dedup and
 * new-occurrence rule reads from this sentence): one occurrence is one
 * (instance, step, class) failure EPISODE, keyed by the recorded qitem id
 * of the packet that embodies the episode — re-detections of the same
 * unresolved episode share the key and dedupe into ONE item; resolve+resume
 * closes the occurrence, and any later episode of the same step carries a
 * NEW packet id and is therefore a NEW occurrence, never absorbed by the
 * resolved past.
 *
 * The key is a RECORDED FACT (arch cell-2 ruling: identity = structured
 * tags; a column stays delivery's option — not taken):
 *   (a) the frontier packet whose failed close felled the instance
 *   (b) the overdue packet named by the deadline evaluator's evidence
 *   (c) the compiled gate packet parked on the human
 */
export interface WorkflowExceptionIdentity {
    workflowName: string;
    instanceId: string;
    /** Nullable only for class (a) on a pre-R2 row with no trail context. */
    stepId: string | null;
    exceptionClass: WorkflowExceptionClass;
    /** The recorded packet id of this episode — see the occurrence JSDoc. */
    occurrenceKey: string;
}
export interface WorkflowException {
    identity: WorkflowExceptionIdentity;
    /** Plain-language, evidence-bearing reason (rides the item's summary). */
    reason: string;
    /** Class-(b) carries the evaluator's evidence verbatim; (a)/(c) null. */
    deadlineEvidence: WorkflowStepDeadlineEvidence | null;
}
/** The minimal recorded-state view class (a) classifies over. Callers pass
 *  the failed close's recorded facts (trail row / lastContinuationDecision);
 *  this module never queries. */
export interface FailedInstanceView {
    instance: Pick<WorkflowInstance, "instanceId" | "workflowName" | "status" | "currentStepId" | "lastContinuationDecision">;
    /** The step that closed failed (trail.step_id of the failing close). */
    failedStepId: string | null;
    /** The packet whose failed close felled the instance (trail.prior_qitem_id). */
    failedPacketId: string;
    /** The recorded failure note if any (resultNote / event reason). */
    failureReason: string | null;
}
/**
 * Class (a): unmapped_failed. Pure: same view → same classification,
 * replayed N times. A non-failed instance NEVER classifies (the mapped-
 * failed negative: branch-routed failures keep status=active and are
 * deterministic remediation, not exceptions).
 */
export declare function classifyFailedInstance(view: FailedInstanceView): WorkflowException | null;
/** Class (a) from a recorded unhandled failed close. Dependency callers have
 * already classified the exit/route; another branch may keep the instance active.
 * Mapped remediation exits must never call this occurrence constructor. */
export declare function classifyFailureOccurrence(view: Omit<FailedInstanceView, "instance"> & {
    instance: Pick<WorkflowInstance, "instanceId" | "workflowName">;
}): WorkflowException;
/**
 * Class (b): stuck_overdue. CONSUMES the WF-1 evaluator's verdict verbatim
 * (rail: the single threshold home classifies; this function only lifts a
 * non-healthy verdict into the exception shape). Healthy → null.
 */
export declare function classifyDeadlineVerdict(workflowName: string, verdict: WorkflowDeadlineVerdict): WorkflowException | null;
/** The recorded facts of a gate reach — the compiled kind is WF-2's
 *  recorded output, not a re-derivation. */
export interface GateTripView {
    workflowName: string;
    instanceId: string;
    gatedStepId: string;
    /** GateCompileResult.kind — "human" | "handler-role". */
    gateKind: "human" | "handler-role";
    /** The compiled gate packet's qitem id. */
    gatePacketId: string;
    /** The human seat the packet parks on (null for handler-role). */
    parkOn: string | null;
}
/**
 * Class (c): human_gate_trip — HUMAN-target gates only. THE HANDLER-ROLE
 * NEGATIVE lives here: a handler-role gate returns null (a deterministic
 * handoff, not an exception; the (a)/(b) backstop covers the handler's own
 * step). Class (c) is intrinsically human-only at the dial.
 */
export declare function classifyGateTrip(view: GateTripView): WorkflowException | null;
/** Tag prefixes: `workflow:`/`instance:` extend the SHIPPED stamp
 *  (workflow-runtime.ts / workflow-projector.ts already emit them);
 *  `step:`/`exception:`/`occurrence:` are WF-5's additions (arch cell 2).
 *  FR-2 dedup and FR-3 cross-channel one-count JOIN on these BY QUERY —
 *  never by summary parsing. */
export declare function workflowExceptionTags(identity: WorkflowExceptionIdentity): string[];
/** The query key for within-occurrence dedup: one item per this tuple. */
export declare function occurrenceDedupKey(identity: WorkflowExceptionIdentity): string;
//# sourceMappingURL=workflow-exception.d.ts.map