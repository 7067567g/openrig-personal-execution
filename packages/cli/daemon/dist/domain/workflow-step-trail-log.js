// PL-004 Phase D: workflow step trail log (append-only).
//
// Owns inserts into workflow_step_trails. Append-only at the API
// surface: only `record()` is exposed. UPDATE/DELETE/remove are not
// methods — direct SQL could mutate but is a contract violation
// enforced at this domain boundary (per PRD § L4 Workflow Runtime).
//
// Pattern mirrors Phase C's WatchdogHistoryLog and Phase A's
// QueueTransitionLog.
import { ulid } from "ulid";
export class WorkflowStepTrailLog {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Append a step trail entry. Returns the persisted entry. Designed
     * to compose inside an outer caller-managed transaction (used by
     * workflow-projector for the transactional-scribe contract).
     */
    record(input) {
        const trailId = ulid();
        this.db
            .prepare(`INSERT INTO workflow_step_trails (
           trail_id, instance_id, step_id, step_role, closed_at,
           closure_reason, closure_evidence_json, actor_session,
           next_qitem_id, prior_qitem_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(trailId, input.instanceId, input.stepId, input.stepRole, input.closedAt, input.closureReason, input.closureEvidence ? JSON.stringify(input.closureEvidence) : null, input.actorSession, input.nextQitemId ?? null, input.priorQitemId);
        return {
            trailId,
            instanceId: input.instanceId,
            stepId: input.stepId,
            stepRole: input.stepRole,
            closedAt: input.closedAt,
            closureReason: input.closureReason,
            closureEvidence: input.closureEvidence ?? null,
            actorSession: input.actorSession,
            nextQitemId: input.nextQitemId ?? null,
            priorQitemId: input.priorQitemId,
        };
    }
    listForInstance(instanceId, limit = 50) {
        const rows = this.db
            .prepare(`SELECT * FROM workflow_step_trails WHERE instance_id = ?
         ORDER BY closed_at DESC, rowid DESC LIMIT ?`)
            .all(instanceId, limit);
        return rows.map(rowToEntry);
    }
    /**
     * Oldest first, in the order the rows were recorded. rowid follows
     * inserts in this append-only table, so the order holds even when
     * closed_at does not move forward.
     */
    listForInstanceInAppendOrder(instanceId) {
        const rows = this.db
            .prepare(`SELECT * FROM workflow_step_trails WHERE instance_id = ? ORDER BY rowid`)
            .all(instanceId);
        return rows.map(rowToEntry);
    }
    countForInstance(instanceId) {
        const row = this.db
            .prepare(`SELECT COUNT(*) AS n FROM workflow_step_trails WHERE instance_id = ?`)
            .get(instanceId);
        return row.n;
    }
}
function rowToEntry(row) {
    return {
        trailId: row.trail_id,
        instanceId: row.instance_id,
        stepId: row.step_id,
        stepRole: row.step_role,
        closedAt: row.closed_at,
        closureReason: row.closure_reason,
        closureEvidence: row.closure_evidence_json
            ? JSON.parse(row.closure_evidence_json)
            : null,
        actorSession: row.actor_session,
        nextQitemId: row.next_qitem_id,
        priorQitemId: row.prior_qitem_id,
    };
}
//# sourceMappingURL=workflow-step-trail-log.js.map