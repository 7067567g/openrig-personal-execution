import { ulid } from "ulid";
/**
 * CRUD repository for pods (bounded context domains within a rig).
 * @param db - shared database handle
 */
export class PodRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Create a pod within a rig.
     * @param rigId - parent rig id
     * @param label - human-readable pod label
     * @param opts - optional summary and continuity policy JSON
     * @returns the created Pod
     */
    createPod(rigId, namespace, label, opts) {
        const id = ulid();
        this.db
            .prepare("INSERT INTO pods (id, rig_id, namespace, label, summary, continuity_policy_json) VALUES (?, ?, ?, ?, ?, ?)")
            .run(id, rigId, namespace, label, opts?.summary ?? null, opts?.continuityPolicyJson ?? null);
        return this.rowToPod(this.db.prepare("SELECT * FROM pods WHERE id = ?").get(id));
    }
    /**
     * Get a pod by id.
     * @param podId - pod id
     * @returns Pod or null if not found
     */
    getPod(podId) {
        const row = this.db.prepare("SELECT * FROM pods WHERE id = ?").get(podId);
        return row ? this.rowToPod(row) : null;
    }
    /** Get a pod by rig and authored namespace. Returns null if not found. */
    getPodByNamespace(rigId, namespace) {
        const row = this.db.prepare("SELECT * FROM pods WHERE rig_id = ? AND namespace = ?").get(rigId, namespace);
        return row ? this.rowToPod(row) : null;
    }
    /**
     * Get all pods for a rig.
     * @param rigId - rig id
     * @returns array of Pods ordered by creation time
     */
    getPodsForRig(rigId) {
        const rows = this.db
            .prepare("SELECT * FROM pods WHERE rig_id = ? ORDER BY created_at")
            .all(rigId);
        return rows.map((r) => this.rowToPod(r));
    }
    /**
     * Delete a pod by id.
     * Nodes with this pod_id will have pod_id set to NULL (ON DELETE SET NULL).
     * @param podId - pod id
     */
    deletePod(podId) {
        this.db.prepare("DELETE FROM pods WHERE id = ?").run(podId);
    }
    // -- Continuity state operations --
    getContinuityStatesForRig(rigId) {
        const podIds = this.db.prepare("SELECT id FROM pods WHERE rig_id = ?").all(rigId);
        if (podIds.length === 0)
            return [];
        const rows = this.db.prepare(`SELECT * FROM continuity_state WHERE pod_id IN (${podIds.map(() => "?").join(",")})`).all(...podIds.map((p) => p.id));
        return rows.map((r) => ({
            podId: r.pod_id,
            nodeId: r.node_id,
            status: r.status,
            artifactsJson: r.artifacts_json,
            lastSyncAt: r.last_sync_at,
            updatedAt: r.updated_at,
        }));
    }
    updateContinuityState(podId, nodeId, status, artifactsJson) {
        this.db.prepare(`INSERT INTO continuity_state (pod_id, node_id, status, artifacts_json, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(pod_id, node_id) DO UPDATE SET status = ?, artifacts_json = ?, updated_at = datetime('now')`).run(podId, nodeId, status, artifactsJson ?? null, status, artifactsJson ?? null);
    }
    rowToPod(row) {
        return {
            id: row.id,
            rigId: row.rig_id,
            namespace: row.namespace,
            label: row.label,
            summary: row.summary,
            continuityPolicyJson: row.continuity_policy_json,
            createdAt: row.created_at,
        };
    }
}
//# sourceMappingURL=pod-repository.js.map