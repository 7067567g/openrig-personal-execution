// OPR.0.4.6.WF5 FR-1: the closed exception taxonomy.
//
// An EXCEPTION is one of exactly three classes, each a PURE PREDICATE over
// recorded state (BR-1: never ambient probing, never judgment in the engine —
// agent judgment lives in RESOLVING, not detecting). Extending this taxonomy
// is a convention change, not driver discretion.
//
//   (a) unmapped_failed — an unhandled failed occurrence (a serial failed
//       instance or one failed dependency branch). A MAPPED
//       `failed` exit routes to its WF-2 remediation branch inside the same
//       transaction (instance stays active) and is NOT an exception; only an
//       unrouted failed close — including the engine-authored max_hops
//       conversion — is an exception. Independent live branches need not
//       stop for that occurrence to require an owner.
//   (b) stuck_overdue — a frontier packet past its deadline AS CLASSIFIED BY
//       WF-1 FR-2's evaluator (workflow-deadline.ts, the single threshold
//       home). This module consumes the verdict verbatim and never
//       recomputes an anchor or threshold.
//   (c) human_gate_trip — a WF-2 gate with a HUMAN target reached. The
//       WF-2-compiled park IS the attention item (FR-2 mints no second one);
//       this class exists so the item carries the exception identity.
//
// THE HANDLER-ROLE SPLIT (spec-guard blocker 2, ratified): a handler-role
// gate-trip is NOT an exception — it is a deterministic agent handoff by
// design. The escalation leg is the backstop BEHIND the handler: if the
// handler's own step fails or goes stuck, classes (a)/(b) fire on it.
//
// v1.3: CLASSIFICATION ≠ ROUTING. The maturity dial (workflow-exception-
// router.ts) maps class → target; nothing here knows about destinations.
export const WORKFLOW_EXCEPTION_CLASSES = [
    "unmapped_failed",
    "stuck_overdue",
    "human_gate_trip",
];
/**
 * Class (a): unmapped_failed. Pure: same view → same classification,
 * replayed N times. A non-failed instance NEVER classifies (the mapped-
 * failed negative: branch-routed failures keep status=active and are
 * deterministic remediation, not exceptions).
 */
export function classifyFailedInstance(view) {
    if (view.instance.status !== "failed")
        return null;
    return classifyFailureOccurrence(view);
}
/** Class (a) from a recorded unhandled failed close. Dependency callers have
 * already classified the exit/route; another branch may keep the instance active.
 * Mapped remediation exits must never call this occurrence constructor. */
export function classifyFailureOccurrence(view) {
    return {
        identity: {
            workflowName: view.instance.workflowName,
            instanceId: view.instance.instanceId,
            stepId: view.failedStepId,
            exceptionClass: "unmapped_failed",
            occurrenceKey: view.failedPacketId,
        },
        reason: view.failureReason
            ? `workflow step failed with no remediation branch: ${view.failureReason}`
            : "workflow step failed with no remediation branch",
        deadlineEvidence: null,
    };
}
/**
 * Class (b): stuck_overdue. CONSUMES the WF-1 evaluator's verdict verbatim
 * (rail: the single threshold home classifies; this function only lifts a
 * non-healthy verdict into the exception shape). Healthy → null.
 */
export function classifyDeadlineVerdict(workflowName, verdict) {
    if (verdict.state === "healthy" || !verdict.evidence)
        return null;
    const e = verdict.evidence;
    return {
        identity: {
            workflowName,
            instanceId: e.instanceId,
            stepId: e.stepId,
            exceptionClass: "stuck_overdue",
            occurrenceKey: e.packetId,
        },
        reason: `workflow step ${e.stepId ?? "(unbound)"} is ${verdict.state} — packet ${e.packetId} ` +
            `held by ${e.ownerSession}, ${e.overdueBySeconds}s past its ${e.anchor} anchor`,
        deadlineEvidence: e,
    };
}
/**
 * Class (c): human_gate_trip — HUMAN-target gates only. THE HANDLER-ROLE
 * NEGATIVE lives here: a handler-role gate returns null (a deterministic
 * handoff, not an exception; the (a)/(b) backstop covers the handler's own
 * step). Class (c) is intrinsically human-only at the dial.
 */
export function classifyGateTrip(view) {
    if (view.gateKind !== "human")
        return null;
    return {
        identity: {
            workflowName: view.workflowName,
            instanceId: view.instanceId,
            stepId: view.gatedStepId,
            exceptionClass: "human_gate_trip",
            occurrenceKey: view.gatePacketId,
        },
        reason: `human decision required at gated step ${view.gatedStepId}` +
            (view.parkOn ? ` (parked on ${view.parkOn})` : ""),
        deadlineEvidence: null,
    };
}
/** Tag prefixes: `workflow:`/`instance:` extend the SHIPPED stamp
 *  (workflow-runtime.ts / workflow-projector.ts already emit them);
 *  `step:`/`exception:`/`occurrence:` are WF-5's additions (arch cell 2).
 *  FR-2 dedup and FR-3 cross-channel one-count JOIN on these BY QUERY —
 *  never by summary parsing. */
export function workflowExceptionTags(identity) {
    const tags = [
        "workflow-exception",
        `workflow:${identity.workflowName}`,
        `instance:${identity.instanceId}`,
        `exception:${identity.exceptionClass}`,
        `occurrence:${identity.occurrenceKey}`,
    ];
    if (identity.stepId)
        tags.splice(3, 0, `step:${identity.stepId}`);
    return tags;
}
/** The query key for within-occurrence dedup: one item per this tuple. */
export function occurrenceDedupKey(identity) {
    return `${identity.instanceId}|${identity.stepId ?? ""}|${identity.exceptionClass}|${identity.occurrenceKey}`;
}
//# sourceMappingURL=workflow-exception.js.map