function rowToVerdict(row) {
    return {
        nodeId: row.node_id,
        verdict: row.verdict,
        evidenceSource: row.evidence_source,
        reason: row.reason,
        evidence: {
            registeredPane: row.registered_pane,
            observedPid: row.observed_pid,
            observedCommand: row.observed_command,
            matchedLayer: row.matched_layer,
        },
        sessionName: row.session_name,
        observedAt: row.observed_at,
    };
}
/**
 * OPR.0.4.3.19 — explicit, durable store for the per-node liveness identity
 * verdict (migration 046 `seat_identity_verdicts`). The reconciler writes;
 * node-inventory reads. Kept as a thin, stateless wrapper over the table so
 * the liveness truth lives in the DB, never in transient in-memory state
 * (dev-guard plan-review caveat).
 *
 * Reads are DEFENSIVE: fixtures that bypass the canonical migration list (no
 * `seat_identity_verdicts` table) get an empty map/undefined rather than a
 * crash — the projection degrades to "no verdict" (never down-ranks), matching
 * the fail-open-on-unknown contract.
 */
export class SeatIdentityStore {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Upsert one node's verdict (last-writer-wins per node). */
    upsert(v) {
        this.db.prepare(`
      INSERT INTO seat_identity_verdicts
        (node_id, verdict, evidence_source, reason, registered_pane, observed_pid, observed_command, matched_layer, session_name, observed_at)
      VALUES (@node_id, @verdict, @evidence_source, @reason, @registered_pane, @observed_pid, @observed_command, @matched_layer, @session_name, @observed_at)
      ON CONFLICT(node_id) DO UPDATE SET
        verdict = excluded.verdict,
        evidence_source = excluded.evidence_source,
        reason = excluded.reason,
        registered_pane = excluded.registered_pane,
        observed_pid = excluded.observed_pid,
        observed_command = excluded.observed_command,
        matched_layer = excluded.matched_layer,
        session_name = excluded.session_name,
        observed_at = excluded.observed_at
    `).run({
            node_id: v.nodeId,
            verdict: v.verdict,
            evidence_source: v.evidenceSource,
            reason: v.reason,
            registered_pane: v.evidence.registeredPane,
            observed_pid: v.evidence.observedPid,
            observed_command: v.evidence.observedCommand,
            matched_layer: v.evidence.matchedLayer,
            session_name: v.sessionName,
            observed_at: v.observedAt,
        });
    }
    /** Read all verdicts for the nodes of a rig, keyed by node_id. Defensive. */
    getForRig(rigId) {
        const out = new Map();
        try {
            const rows = this.db.prepare(`
        SELECT v.* FROM seat_identity_verdicts v
        JOIN nodes n ON n.id = v.node_id
        WHERE n.rig_id = ?
      `).all(rigId);
            for (const row of rows)
                out.set(row.node_id, rowToVerdict(row));
        }
        catch {
            // Table absent (partial fixture) — degrade to no verdicts.
        }
        return out;
    }
    /**
     * FS-1 W1.2 — all rigs' verdicts in ONE query, keyed rigId → (nodeId →
     * verdict). Same JOIN + `rowToVerdict` as `getForRig`, minus the per-rig
     * WHERE — so a per-rig `getForAllRigs().get(rigId)` is equivalent to
     * `getForRig(rigId)` (empty map when a rig has no verdicts). Defensive.
     */
    getForAllRigs() {
        const out = new Map();
        try {
            const rows = this.db.prepare(`
        SELECT v.*, n.rig_id as owning_rig_id FROM seat_identity_verdicts v
        JOIN nodes n ON n.id = v.node_id
      `).all();
            for (const row of rows) {
                let m = out.get(row.owning_rig_id);
                if (!m) {
                    m = new Map();
                    out.set(row.owning_rig_id, m);
                }
                m.set(row.node_id, rowToVerdict(row));
            }
        }
        catch {
            // Table absent (partial fixture) — degrade to no verdicts.
        }
        return out;
    }
    /** Read a single node's verdict, or null. Defensive. */
    getForNode(nodeId) {
        try {
            const row = this.db.prepare("SELECT * FROM seat_identity_verdicts WHERE node_id = ?").get(nodeId);
            return row ? rowToVerdict(row) : null;
        }
        catch {
            return null;
        }
    }
    /** Drop verdicts for nodes no longer in the live set (memory/table hygiene). */
    pruneExcept(liveNodeIds) {
        try {
            const existing = this.db.prepare("SELECT node_id FROM seat_identity_verdicts").all();
            const live = new Set(liveNodeIds);
            const del = this.db.prepare("DELETE FROM seat_identity_verdicts WHERE node_id = ?");
            for (const r of existing) {
                if (!live.has(r.node_id))
                    del.run(r.node_id);
            }
        }
        catch {
            // Table absent — nothing to prune.
        }
    }
}
/**
 * 51-09 increment 1 — thin durable store for the daemon's own self-host id
 * (migration 059 `self_host_identity`, singleton row). Co-located with the
 * seat-identity substrate per arch ruling cb19867f (extend, do not invent a
 * parallel identity store). The reconciler mints once + reconciles at boot; this
 * store is the DB access seam only (no policy — mint/reconcile decisions live in
 * seat-identity-reconciler.ts). Reads are DEFENSIVE (table absent → null),
 * matching SeatIdentityStore's fixture-tolerant contract.
 */
export class SelfHostIdentityStore {
    db;
    constructor(db) {
        this.db = db;
    }
    /** The current self-host record, or null when none has been minted. */
    get() {
        try {
            const row = this.db.prepare("SELECT host_id, minted_at, reconciled_at FROM self_host_identity WHERE singleton = 1").get();
            return row ? { hostId: row.host_id, mintedAt: row.minted_at, reconciledAt: row.reconciled_at } : null;
        }
        catch {
            return null;
        }
    }
    /** Insert the singleton self-host record (first boot only). minted_at == reconciled_at at mint. */
    mint(hostId, nowIso) {
        this.db.prepare("INSERT INTO self_host_identity (singleton, host_id, minted_at, reconciled_at) VALUES (1, ?, ?, ?)").run(hostId, nowIso, nowIso);
        return { hostId, mintedAt: nowIso, reconciledAt: nowIso };
    }
    /** Advance reconciled_at on the existing singleton row; host_id + minted_at are never touched. */
    touchReconciledAt(nowIso) {
        this.db.prepare("UPDATE self_host_identity SET reconciled_at = ? WHERE singleton = 1").run(nowIso);
    }
}
//# sourceMappingURL=seat-identity-store.js.map