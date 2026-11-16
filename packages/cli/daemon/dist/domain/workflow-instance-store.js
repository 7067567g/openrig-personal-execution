// PL-004 Phase D: workflow instance store.
//
// Owns CRUD on workflow_instances. Frontier tracking uses
// current_frontier_json (serialized JSON array of qitem_ids). Survives
// daemon restart without filesystem reconciliation: list/getById query
// SQLite directly.
import { ulid } from "ulid";
import { WorkflowScopeError } from "./workflow-scope.js";
/** Defensive column probe (the detectQueueColumn house pattern) —
 *  older test fixtures bypass the canonical migration list, so the
 *  version column (migration 049) may be absent; the guard degrades
 *  to legacy unguarded updates there. Production always migrates. */
export function detectInstanceColumn(db, columnName, opts = {}) {
    try {
        return db
            .prepare("PRAGMA table_info(workflow_instances)")
            .all()
            .some((row) => row.name === columnName);
    }
    catch (err) {
        // The store's own probes tolerate a failed PRAGMA; a caller that must tell "no column" from "could not look" asks for strict.
        if (opts.strict)
            throw err;
        return false;
    }
}
export class WorkflowInstanceError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "WorkflowInstanceError";
    }
}
export class WorkflowInstanceStore {
    db;
    now;
    hasVersionColumn;
    hasResumeColumns;
    hasBoundRigColumn;
    hasLifecycleColumns;
    hasScopeColumn;
    hasFrontierBindingsTable;
    hasFailureOccurrencesTable;
    constructor(db, now = () => new Date()) {
        this.db = db;
        this.now = now;
        this.hasVersionColumn = detectInstanceColumn(db, "version");
        this.hasResumeColumns = detectInstanceColumn(db, "resume_count");
        this.hasBoundRigColumn = detectInstanceColumn(db, "bound_rig");
        this.hasLifecycleColumns = detectInstanceColumn(db, "lifecycle_operation_key");
        this.hasScopeColumn = detectInstanceColumn(db, "scope_json");
        this.hasFrontierBindingsTable = tableExists(db, "workflow_frontier_bindings");
        this.hasFailureOccurrencesTable = tableExists(db, "workflow_failure_occurrences");
    }
    create(input) {
        const instanceId = ulid();
        const createdAt = this.now().toISOString();
        const frontier = input.initialFrontier ?? [];
        // OPR.0.4.6.FAC1: bound_rig rides the same defensive column probe
        // as version/resume (legacy fixtures without migration 052 keep the
        // legacy INSERT; production always migrates).
        const boundRigCol = this.hasBoundRigColumn ? ", bound_rig" : "";
        const boundRigVal = this.hasBoundRigColumn ? ", ?" : "";
        const lifecycleCols = this.hasLifecycleColumns
            ? ", lifecycle_operation_key, compiled_input_digest, lifecycle_binding_json"
            : "";
        const lifecycleVals = this.hasLifecycleColumns ? ", ?, ?, ?" : "";
        if (input.scope && !this.hasScopeColumn) {
            throw new WorkflowScopeError("scope_unavailable", "workflow scope requires migration 110");
        }
        const scopeCol = this.hasScopeColumn ? ", scope_json" : "";
        const scopeVal = this.hasScopeColumn ? ", ?" : "";
        const params = [
            instanceId,
            input.workflowName,
            input.workflowVersion,
            input.createdBySession,
            createdAt,
            JSON.stringify(frontier),
            input.currentStepId ?? null,
        ];
        if (this.hasBoundRigColumn)
            params.push(input.boundRig ?? null);
        if (this.hasLifecycleColumns) {
            params.push(input.lifecycle?.operationKey ?? null, input.lifecycle?.compiledInputDigest ?? null, input.lifecycle ? JSON.stringify(input.lifecycle.binding) : null);
        }
        if (this.hasScopeColumn)
            params.push(input.scope ? JSON.stringify(input.scope) : null);
        this.db
            .prepare(`INSERT INTO workflow_instances (
           instance_id, workflow_name, workflow_version, created_by_session,
           created_at, status, current_frontier_json, current_step_id, hop_count${boundRigCol}${lifecycleCols}${scopeCol}
         ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 0${boundRigVal}${lifecycleVals}${scopeVal})`)
            .run(...params);
        return this.getByIdOrThrow(instanceId);
    }
    getById(instanceId) {
        const row = this.db
            .prepare(`SELECT * FROM workflow_instances WHERE instance_id = ?`)
            .get(instanceId);
        return row ? rowToInstance(row) : null;
    }
    getByIdOrThrow(instanceId) {
        const inst = this.getById(instanceId);
        if (!inst) {
            throw new WorkflowInstanceError("instance_not_found", `workflow instance ${instanceId} not found`, { instanceId });
        }
        return inst;
    }
    getByLifecycleOperationKey(operationKey) {
        if (!this.hasLifecycleColumns)
            return null;
        const row = this.db
            .prepare(`SELECT * FROM workflow_instances WHERE lifecycle_operation_key = ?`)
            .get(operationKey);
        return row ? rowToInstance(row) : null;
    }
    /** Caller wraps cache/binding/receipt/event in one transaction. No packet or trail is rewritten. */
    reviseLifecycle(instanceId, expectedVersion, workflowVersion, digest, binding) {
        const result = this.db.prepare("UPDATE workflow_instances SET workflow_version = ?, compiled_input_digest = ?, lifecycle_binding_json = ?, version = version + 1 WHERE instance_id = ? AND version = ?")
            .run(workflowVersion, digest, JSON.stringify(binding), instanceId, expectedVersion);
        if (result.changes !== 1)
            throw new WorkflowInstanceError("instance_version_conflict", "Instance progressed during revision; inspect it again.", { instanceId, expectedVersion });
    }
    bindFrontierPacket(input) {
        if (!this.hasFrontierBindingsTable) {
            throw new WorkflowInstanceError("frontier_bindings_unavailable", "packet-addressed workflow state requires migration 079");
        }
        const createdAt = this.now().toISOString();
        this.db.prepare(`INSERT INTO workflow_frontier_bindings
       (instance_id, packet_id, step_id, branch_drive, hop_count, hops_baseline, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(input.instanceId, input.packetId, input.stepId, input.branchDrive ?? 0, input.hopCount ?? 0, input.hopsBaseline ?? 0, createdAt);
        return this.getFrontierBinding(input.instanceId, input.packetId);
    }
    removeFrontierBinding(instanceId, packetId) {
        if (!this.hasFrontierBindingsTable)
            return;
        this.db.prepare(`DELETE FROM workflow_frontier_bindings WHERE instance_id = ? AND packet_id = ?`)
            .run(instanceId, packetId);
    }
    getFrontierBinding(instanceId, packetId) {
        if (!this.hasFrontierBindingsTable)
            return null;
        const row = this.db.prepare(`SELECT * FROM workflow_frontier_bindings WHERE instance_id = ? AND packet_id = ?`).get(instanceId, packetId);
        return row ? rowToFrontierBinding(row) : null;
    }
    listFrontierBindings(instanceId) {
        if (!this.hasFrontierBindingsTable)
            return [];
        const rows = this.db.prepare(`SELECT * FROM workflow_frontier_bindings WHERE instance_id = ? ORDER BY created_at, packet_id`).all(instanceId);
        return rows.map(rowToFrontierBinding);
    }
    recordFailureOccurrence(input) {
        if (!this.hasFailureOccurrencesTable) {
            throw new WorkflowInstanceError("failure_occurrences_unavailable", "branch-local workflow recovery requires migration 079");
        }
        const failedAt = this.now().toISOString();
        this.db.prepare(`INSERT INTO workflow_failure_occurrences
       (occurrence_id, instance_id, failed_packet_id, step_id, branch_drive,
        hop_count, hops_baseline, failure_reason, status, failed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unresolved', ?)`).run(input.failedPacketId, input.instanceId, input.failedPacketId, input.stepId, input.branchDrive ?? 0, input.hopCount ?? 0, input.hopsBaseline ?? 0, input.failureReason ?? null, failedAt);
        return this.getFailureOccurrence(input.instanceId, input.failedPacketId);
    }
    getFailureOccurrence(instanceId, occurrenceId) {
        if (!this.hasFailureOccurrencesTable)
            return null;
        const row = this.db.prepare(`SELECT * FROM workflow_failure_occurrences WHERE instance_id = ? AND occurrence_id = ?`).get(instanceId, occurrenceId);
        return row ? rowToFailureOccurrence(row) : null;
    }
    listFailureOccurrences(instanceId, status) {
        if (!this.hasFailureOccurrencesTable)
            return [];
        const rows = status
            ? this.db.prepare(`SELECT * FROM workflow_failure_occurrences WHERE instance_id = ? AND status = ? ORDER BY failed_at, occurrence_id`).all(instanceId, status)
            : this.db.prepare(`SELECT * FROM workflow_failure_occurrences WHERE instance_id = ? ORDER BY failed_at, occurrence_id`).all(instanceId);
        return rows.map(rowToFailureOccurrence);
    }
    resolveFailureOccurrence(instanceId, occurrenceId, redrivePacketId, resumeDecision) {
        if (!this.hasFailureOccurrencesTable)
            return;
        const info = this.db.prepare(`UPDATE workflow_failure_occurrences
       SET status = 'resolved', redrive_packet_id = ?, resume_decision = ?, resolved_at = ?
       WHERE instance_id = ? AND occurrence_id = ? AND status = 'unresolved'`).run(redrivePacketId, resumeDecision ?? null, this.now().toISOString(), instanceId, occurrenceId);
        if (info.changes === 0) {
            throw new WorkflowInstanceError("failure_occurrence_not_unresolved", `failure occurrence ${occurrenceId} is not unresolved for instance ${instanceId}`, { instanceId, occurrenceId });
        }
    }
    listByStatus(status) {
        const rows = this.db
            .prepare(`SELECT * FROM workflow_instances WHERE status = ? ORDER BY created_at ASC`)
            .all(status);
        return rows.map(rowToInstance);
    }
    listAll() {
        const rows = this.db
            .prepare(`SELECT * FROM workflow_instances ORDER BY created_at ASC`)
            .all();
        return rows.map(rowToInstance);
    }
    /**
     * Update frontier + status atomically. Caller is responsible for
     * wrapping in a transaction when this needs to compose with other
     * mutations (e.g., workflow-projector folds this into the
     * close + create + frontier-update transaction).
     */
    updateFrontier(instanceId, nextFrontier, nextStatus, opts = {}) {
        const setHop = opts.bumpHopCount ? "hop_count = hop_count + 1, " : "";
        const setResume = opts.resumeStamp && this.hasResumeColumns
            ? `resume_count = ${Number(opts.resumeStamp.resumeCount)}, hops_baseline = ${Number(opts.resumeStamp.hopsBaseline)}, `
            : "";
        const guardVersion = opts.expectedVersion !== undefined && this.hasVersionColumn;
        const setVersion = guardVersion ? "version = version + 1, " : "";
        const versionWhere = guardVersion ? " AND version = ?" : "";
        let currentStepClause = "";
        let currentStepValue;
        if (opts.currentStepId === "preserve" || opts.currentStepId === undefined) {
            currentStepClause = "";
            currentStepValue = undefined;
        }
        else if (opts.currentStepId === "clear") {
            currentStepClause = "current_step_id = NULL, ";
        }
        else {
            currentStepClause = "current_step_id = ?, ";
            currentStepValue = opts.currentStepId;
        }
        const sql = `UPDATE workflow_instances SET
           ${setVersion}${setHop}${setResume}${currentStepClause}status = ?, current_frontier_json = ?,
           last_continuation_decision_json = COALESCE(?, last_continuation_decision_json),
           fallback_synthesis = COALESCE(?, fallback_synthesis),
           completed_at = COALESCE(?, completed_at)
         WHERE instance_id = ?${versionWhere}`;
        const stmt = this.db.prepare(sql);
        const params = [];
        if (currentStepValue !== undefined)
            params.push(currentStepValue);
        params.push(nextStatus, JSON.stringify(nextFrontier), opts.lastContinuationDecision ? JSON.stringify(opts.lastContinuationDecision) : null, opts.fallbackSynthesis ?? null, opts.completedAt ?? null, instanceId);
        if (guardVersion)
            params.push(opts.expectedVersion);
        const info = stmt.run(...params);
        if (guardVersion && info.changes === 0) {
            const current = this.getById(instanceId);
            throw new WorkflowInstanceError("instance_version_conflict", `workflow instance ${instanceId} advanced concurrently: expected version ${opts.expectedVersion}, actual ${current ? current.version : "(instance missing)"} — the losing writer's transaction rolls back whole; re-read and re-project against current state`, {
                instanceId,
                expectedVersion: opts.expectedVersion,
                actualVersion: current?.version ?? null,
            });
        }
    }
}
function rowToInstance(row) {
    return {
        instanceId: row.instance_id,
        workflowName: row.workflow_name,
        workflowVersion: row.workflow_version,
        createdBySession: row.created_by_session,
        createdAt: row.created_at,
        status: row.status,
        currentFrontier: JSON.parse(row.current_frontier_json),
        currentStepId: row.current_step_id,
        hopCount: row.hop_count,
        fallbackSynthesis: row.fallback_synthesis,
        lastContinuationDecision: row.last_continuation_decision_json
            ? JSON.parse(row.last_continuation_decision_json)
            : null,
        completedAt: row.completed_at,
        version: row.version ?? 0,
        resumeCount: row.resume_count ?? 0,
        hopsBaseline: row.hops_baseline ?? 0,
        boundRig: row.bound_rig ?? null,
        lifecycleOperationKey: row.lifecycle_operation_key ?? null,
        compiledInputDigest: row.compiled_input_digest ?? null,
        lifecycleBinding: row.lifecycle_binding_json
            ? JSON.parse(row.lifecycle_binding_json)
            : null,
        scope: row.scope_json ? JSON.parse(row.scope_json) : null,
    };
}
function rowToFrontierBinding(row) {
    return {
        instanceId: row.instance_id,
        packetId: row.packet_id,
        stepId: row.step_id,
        branchDrive: row.branch_drive,
        hopCount: row.hop_count,
        hopsBaseline: row.hops_baseline,
        createdAt: row.created_at,
    };
}
function rowToFailureOccurrence(row) {
    return {
        occurrenceId: row.occurrence_id,
        instanceId: row.instance_id,
        failedPacketId: row.failed_packet_id,
        stepId: row.step_id,
        branchDrive: row.branch_drive,
        hopCount: row.hop_count,
        hopsBaseline: row.hops_baseline,
        failureReason: row.failure_reason,
        status: row.status,
        redrivePacketId: row.redrive_packet_id,
        resumeDecision: row.resume_decision,
        failedAt: row.failed_at,
        resolvedAt: row.resolved_at,
    };
}
function tableExists(db, tableName) {
    try {
        return db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(tableName) !== undefined;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=workflow-instance-store.js.map