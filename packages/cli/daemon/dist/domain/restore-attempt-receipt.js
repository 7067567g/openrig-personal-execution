import { rollupRestoreRigResult } from "./restore-orchestrator.js";
/** Fold append-only restore events into the current attempt view. No row is
 * written and the original restore.completed payload is returned untouched. */
export function deriveRestoreAttemptReceipt(db, rigId, attemptId) {
    const startedRow = db.prepare("SELECT seq, rig_id, type, payload, created_at FROM events WHERE seq = ? AND type = 'restore.started'").get(attemptId);
    if (!startedRow)
        return { ok: false, code: "attempt_not_found", message: `Restore attempt ${attemptId} not found` };
    if (startedRow.rig_id !== rigId) {
        return { ok: false, code: "attempt_wrong_rig", message: `Restore attempt ${attemptId} belongs to rig ${startedRow.rig_id}, not ${rigId}` };
    }
    const next = db.prepare("SELECT seq FROM events WHERE rig_id = ? AND type = 'restore.started' AND seq > ? ORDER BY seq LIMIT 1").get(rigId, attemptId);
    const completedRow = db.prepare(`SELECT seq, rig_id, type, payload, created_at FROM events
       WHERE rig_id = ? AND type = 'restore.completed' AND seq > ?${next ? " AND seq < ?" : ""}
       ORDER BY seq LIMIT 1`).get(...(next ? [rigId, attemptId, next.seq] : [rigId, attemptId]));
    if (!completedRow) {
        return { ok: false, code: "attempt_incomplete", message: `Restore attempt ${attemptId} has no terminal completion event` };
    }
    try {
        const started = JSON.parse(startedRow.payload);
        const completed = JSON.parse(completedRow.payload);
        const originalResult = completed.result;
        const intendedRoster = started.intendedRoster ?? originalResult.intendedRoster ?? originalResult.nodes.map((node) => ({ nodeId: node.nodeId, logicalId: node.logicalId }));
        const intendedIds = new Set(intendedRoster.map((node) => node.nodeId));
        const reconciliationRows = db.prepare("SELECT seq, rig_id, type, payload, created_at FROM events WHERE rig_id = ? AND type = 'restore.outcome_reconciled' AND json_extract(payload, '$.attemptId') = ? ORDER BY seq").all(rigId, attemptId);
        const reconciliations = reconciliationRows.flatMap((row) => {
            const event = JSON.parse(row.payload);
            return intendedIds.has(event.nodeId) ? [{ ...event, seq: row.seq, createdAt: row.created_at }] : [];
        });
        const recovered = new Set(reconciliations.map((event) => event.nodeId));
        const originalByNode = new Map(originalResult.nodes.map((node) => [node.nodeId, node]));
        const currentNodes = intendedRoster.map((intended) => {
            const node = originalByNode.get(intended.nodeId) ?? {
                nodeId: intended.nodeId,
                logicalId: intended.logicalId,
                status: "failed",
                error: "No restore outcome was recorded for this intended seat.",
            };
            return recovered.has(node.nodeId) ? { ...node, status: "operator_recovered" } : { ...node };
        });
        const unresolvedIntendedSeats = currentNodes.filter((node) => (node.status === "failed" || node.status === "attention_required" || node.status === "awaiting-decision"));
        return {
            ok: true,
            attemptId,
            rigId,
            snapshotSelection: started.snapshotSelection ?? originalResult.snapshotSelection ?? null,
            intendedRoster,
            excludedNodes: started.excludedNodes ?? originalResult.excludedNodes ?? [],
            originalResult,
            reconciliations,
            currentNodes,
            unresolvedIntendedSeats,
            currentIntendedSetVerdict: rollupRestoreRigResult(currentNodes),
        };
    }
    catch (error) {
        return { ok: false, code: "attempt_corrupt", message: `Restore attempt ${attemptId} could not be decoded: ${error.message}` };
    }
}
//# sourceMappingURL=restore-attempt-receipt.js.map