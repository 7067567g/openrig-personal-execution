import { ulid } from "ulid";
export class CheckpointStore {
    db;
    constructor(db) {
        this.db = db;
    }
    createCheckpoint(nodeId, data) {
        const id = ulid();
        this.db
            .prepare(`INSERT INTO checkpoints (id, node_id, summary, current_task, next_step, blocked_on, key_artifacts, confidence, pod_id, continuity_source, continuity_artifacts_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, nodeId, data.summary, data.currentTask ?? null, data.nextStep ?? null, data.blockedOn ?? null, JSON.stringify(data.keyArtifacts ?? []), data.confidence ?? null, data.podId ?? null, data.continuitySource ?? null, data.continuityArtifactsJson ?? null);
        return this.rowToCheckpoint(this.db.prepare("SELECT * FROM checkpoints WHERE id = ?").get(id));
    }
    getLatestCheckpoint(nodeId) {
        const row = this.db
            .prepare("SELECT * FROM checkpoints WHERE node_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1")
            .get(nodeId);
        return row ? this.rowToCheckpoint(row) : null;
    }
    getCheckpointsForNode(nodeId) {
        const rows = this.db
            .prepare("SELECT * FROM checkpoints WHERE node_id = ? ORDER BY created_at ASC, rowid ASC")
            .all(nodeId);
        return rows.map((r) => this.rowToCheckpoint(r));
    }
    getCheckpointsForRig(rigId) {
        // Get all nodes for this rig
        const nodes = this.db
            .prepare("SELECT id FROM nodes WHERE rig_id = ?")
            .all(rigId);
        const result = {};
        for (const node of nodes) {
            result[node.id] = this.getLatestCheckpoint(node.id);
        }
        return result;
    }
    rowToCheckpoint(row) {
        return {
            id: row.id,
            nodeId: row.node_id,
            summary: row.summary,
            currentTask: row.current_task,
            nextStep: row.next_step,
            blockedOn: row.blocked_on,
            keyArtifacts: row.key_artifacts ? JSON.parse(row.key_artifacts) : [],
            confidence: row.confidence,
            podId: row.pod_id ?? null,
            continuitySource: row.continuity_source ?? null,
            continuityArtifactsJson: row.continuity_artifacts_json ?? null,
            createdAt: row.created_at,
        };
    }
}
//# sourceMappingURL=checkpoint-store.js.map