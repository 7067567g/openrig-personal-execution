import { ulid } from "ulid";
export class DiscoveryRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Upsert: preserve id + first_seen_at on rescan, update mutable fields. */
    upsertDiscoveredSession(data) {
        const existing = this.db.prepare("SELECT id, first_seen_at FROM discovered_sessions WHERE tmux_session = ? AND tmux_pane = ?").get(data.tmuxSession, data.tmuxPane);
        if (existing) {
            this.db.prepare(`UPDATE discovered_sessions SET
          tmux_window = ?, pid = ?, cwd = ?, active_command = ?,
          runtime_hint = ?, confidence = ?, evidence_json = ?, config_json = ?,
          last_seen_at = datetime('now'),
          status = CASE WHEN status = 'claimed' THEN 'claimed' ELSE 'active' END
        WHERE id = ?`).run(data.tmuxWindow ?? null, data.pid ?? null, data.cwd ?? null, data.activeCommand ?? null, data.runtimeHint, data.confidence, data.evidenceJson ?? null, data.configJson ?? null, existing.id);
            return this.getDiscoveredSession(existing.id);
        }
        const id = ulid();
        this.db.prepare(`INSERT INTO discovered_sessions (id, tmux_session, tmux_window, tmux_pane, pid, cwd, active_command, runtime_hint, confidence, evidence_json, config_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.tmuxSession, data.tmuxWindow ?? null, data.tmuxPane, data.pid ?? null, data.cwd ?? null, data.activeCommand ?? null, data.runtimeHint, data.confidence, data.evidenceJson ?? null, data.configJson ?? null);
        return this.getDiscoveredSession(id);
    }
    markVanished(ids) {
        if (ids.length === 0)
            return;
        const placeholders = ids.map(() => "?").join(",");
        this.db.prepare(`UPDATE discovered_sessions SET status = 'vanished', last_seen_at = datetime('now') WHERE id IN (${placeholders}) AND status = 'active'`).run(...ids);
    }
    markClaimed(id, nodeId) {
        this.db.prepare("UPDATE discovered_sessions SET status = 'claimed', claimed_node_id = ? WHERE id = ?").run(nodeId, id);
    }
    releaseClaimByNodeId(nodeId) {
        this.db.prepare("UPDATE discovered_sessions SET status = 'active', claimed_node_id = NULL, last_seen_at = datetime('now') WHERE claimed_node_id = ?").run(nodeId);
    }
    listDiscovered(status) {
        const rows = status
            ? this.db.prepare("SELECT * FROM discovered_sessions WHERE status = ? ORDER BY last_seen_at DESC").all(status)
            : this.db.prepare("SELECT * FROM discovered_sessions ORDER BY last_seen_at DESC").all();
        return rows.map((r) => this.rowToSession(r));
    }
    getDiscoveredSession(id) {
        const row = this.db.prepare("SELECT * FROM discovered_sessions WHERE id = ?").get(id);
        return row ? this.rowToSession(row) : null;
    }
    /** Get IDs of all active discovered sessions */
    getActiveIds() {
        const rows = this.db.prepare("SELECT id FROM discovered_sessions WHERE status = 'active'").all();
        return rows.map((r) => r.id);
    }
    /** Get active session by tmux identity */
    getByTmuxIdentity(tmuxSession, tmuxPane) {
        const row = this.db.prepare("SELECT * FROM discovered_sessions WHERE tmux_session = ? AND tmux_pane = ? AND status != 'vanished'").get(tmuxSession, tmuxPane);
        return row ? this.rowToSession(row) : null;
    }
    rowToSession(row) {
        return {
            id: row.id,
            tmuxSession: row.tmux_session,
            tmuxWindow: row.tmux_window,
            tmuxPane: row.tmux_pane,
            pid: row.pid,
            cwd: row.cwd,
            activeCommand: row.active_command,
            runtimeHint: row.runtime_hint,
            confidence: row.confidence,
            evidenceJson: row.evidence_json,
            configJson: row.config_json,
            status: row.status,
            claimedNodeId: row.claimed_node_id,
            firstSeenAt: row.first_seen_at,
            lastSeenAt: row.last_seen_at,
        };
    }
}
//# sourceMappingURL=discovery-repository.js.map