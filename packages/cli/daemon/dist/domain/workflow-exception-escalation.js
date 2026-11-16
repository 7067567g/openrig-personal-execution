import { packetScopeTags, readInstanceScope } from "./workflow-scope.js";
import { findQueueRecovery, recoveryId, recoveryTag } from "./queue-recovery.js";
import { QueueRepositoryError } from "./queue-repository.js";
import { classifyDeadlineVerdict, workflowExceptionTags, } from "./workflow-exception.js";
import { workflowHumanDestination } from "./workflow-human-destination.js";
export function makeEnsureStuckExceptionItem(deps) {
    const log = deps.log ?? (() => { });
    return async (input) => {
        const exception = classifyDeadlineVerdict(input.workflowName, input.verdict);
        if (!exception)
            return { outcome: "skipped-healthy" };
        const previous = findQueueRecovery(deps.db, exception.deadlineEvidence.packetId);
        if (previous)
            return { outcome: "deduped", qitemId: previous.qitemId };
        // Honor historical occurrence rows, including their closed disposition.
        // Modern rows were already resolved through the current source episode above.
        const open = deps.db
            .prepare(`SELECT qitem_id, destination_session FROM queue_items
         WHERE json_valid(tags)
           AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)
           AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)
           AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)
           AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = 'workflow-exception')
           AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = 'exception:stuck_overdue')
           AND NOT EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)`)
            .get(`occurrence:${exception.identity.occurrenceKey}`, `instance:${exception.identity.instanceId}`, `workflow:${exception.identity.workflowName}`, recoveryTag(exception.deadlineEvidence.packetId));
        if (open) {
            // Re-detection of the same unresolved episode: re-nudge the ONE
            // item (best-effort — the durable item is the guarantee).
            return { outcome: "deduped", qitemId: open.qitem_id };
        }
        // OPR.0.4.6.FAC1 (arch Q3): each exception item is a FRESH routing
        // decision at its own detection moment — read the stuck instance's
        // bound rig NOW. A failed read cannot establish an unbound instance:
        // propagate it before any routing or queue write.
        let detectionBoundRig = null;
        const stuckInstanceId = exception.deadlineEvidence?.instanceId;
        if (stuckInstanceId) {
            const row = deps.db
                .prepare(`SELECT bound_rig FROM workflow_instances WHERE instance_id = ?`)
                .get(stuckInstanceId);
            detectionBoundRig = row?.bound_rig ?? null;
        }
        const route = deps.resolveRoute(input.workflowName, input.workflowVersion, "stuck_overdue", detectionBoundRig) ?? {
            position: "fallback",
            destinationSession: workflowHumanDestination(deps.humanFallbackSeat),
            tier: "human-gate",
            humanRouted: true,
            resolvedVia: "engine-default",
        };
        const e = exception.deadlineEvidence;
        const evidenceRef = `rig workflow trace ${e.instanceId}`;
        const body = `WORKFLOW EXCEPTION (stuck_overdue)\n` +
            `workflow: ${input.workflowName} v${input.workflowVersion}\n` +
            `instance: ${e.instanceId}\n` +
            `step: ${e.stepId ?? "(unbound)"} — packet ${e.packetId} held by ${e.ownerSession} (${e.packetState})\n` +
            `deadline: ${e.overdueBySeconds}s past the ${e.anchor} anchor (${e.anchorAt}); packet age ${e.ageSeconds}s\n` +
            `reason: ${exception.reason}\n` +
            `evidence: ${evidenceRef}\n` +
            `resolve: inspect the current owner and deadline; packet age alone does not establish idle. This item clears when the instance leaves the exception state.`;
        const scopeTags = packetScopeTags(readInstanceScope(deps.db, e.instanceId), e.stepId);
        const createItem = (destination, tier) => deps.queueRepo.create({
            qitemId: recoveryId(deps.db, e.packetId),
            sourceSession: input.createdBySession,
            destinationSession: destination,
            body,
            priority: "urgent",
            tier,
            tags: [...workflowExceptionTags(exception.identity), recoveryTag(e.packetId), ...scopeTags],
            summary: exception.reason,
            evidenceRef,
        });
        let created;
        try {
            created = await createItem(route.destinationSession, route.tier);
        }
        catch (error) {
            if (!(error instanceof QueueRepositoryError) || error.code !== "unknown_destination_rig" || route.humanRouted)
                throw error;
            // An unavailable agent rig may use the registered human fallback.
            // Other admission/storage failures retain their original diagnosis.
            created = await createItem(workflowHumanDestination(deps.humanFallbackSeat), "human-gate");
        }
        log(`workflow exception: stuck_overdue item ${created.qitemId} created for instance ${e.instanceId} (step ${e.stepId ?? "?"}, ${route.position})`);
        return { outcome: "created", qitemId: created.qitemId };
    };
}
//# sourceMappingURL=workflow-exception-escalation.js.map