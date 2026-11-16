import type { Migration } from "../migrate.js";
/**
 * Workflow step trails (PL-004 Phase D; append-only history).
 *
 * Per PRD § L4 Workflow Runtime: every workflow step transition records
 * a trail entry. Append-only: writers only INSERT. UPDATE/DELETE are
 * not exposed by WorkflowStepTrailLog API; direct SQL would succeed
 * (SQLite has no view/role layer) but is a contract violation enforced
 * at the domain-layer API boundary.
 *
 * Columns:
 *   - trail_id (ULID PK)
 *   - instance_id (FK to workflow_instances)
 *   - step_id (from spec; e.g., "produce", "review-convergence")
 *   - step_role (from spec; e.g., "producer", "orchestrator")
 *   - closed_at (ISO timestamp of the closure/transition)
 *   - closure_reason (enum: "handoff", "waiting", "done", "failed")
 *   - closure_evidence_json (operator-supplied evidence + system-derived
 *     audit context; JSON-encoded)
 *   - actor_session (the session that closed the packet — owner-as-author)
 *   - next_qitem_id (FK to queue_items; null on terminal closure)
 *   - prior_qitem_id (the closed packet; FK to queue_items)
 *
 * Indexes:
 *   - (instance_id, closed_at DESC) — fast "trail for one workflow instance"
 *   - (closed_at DESC) — global recent activity
 */
export declare const workflowStepTrailsSchema: Migration;
//# sourceMappingURL=035_workflow_step_trails.d.ts.map