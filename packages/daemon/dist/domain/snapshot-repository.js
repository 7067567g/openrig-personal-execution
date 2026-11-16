import { ulid } from "ulid";
import { parseSqliteUtcMs } from "./sqlite-time.js";
export class SnapshotRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    createSnapshot(rigId, kind, data) {
        const id = ulid();
        this.db
            .prepare("INSERT INTO snapshots (id, rig_id, kind, data) VALUES (?, ?, ?, ?)")
            .run(id, rigId, kind, JSON.stringify(data));
        return this.rowToSnapshot(this.db.prepare("SELECT * FROM snapshots WHERE id = ?").get(id));
    }
    getSnapshot(id) {
        const row = this.db
            .prepare("SELECT * FROM snapshots WHERE id = ?")
            .get(id);
        return row ? this.rowToSnapshot(row) : null;
    }
    findLatestAutoPreDown(rigId) {
        const row = this.db
            .prepare("SELECT * FROM snapshots WHERE rig_id = ? AND kind = 'auto-pre-down' ORDER BY created_at DESC LIMIT 1")
            .get(rigId);
        return row ? this.rowToSnapshot(row) : null;
    }
    /**
     * Returns the latest snapshot whose persisted `data` carries the minimum
     * structural metadata `RestoreOrchestrator.restore`'s pre-validation requires.
     *
     * OPR.0.3.4.9 Option Y: prefers the most-recent of the crash-insurance tier
     * {auto-pre-down, auto-periodic} -- the freshest of the two wins. A newer
     * auto-periodic beats a stale auto-pre-down (the crash fix); a genuinely-
     * fresher auto-pre-down still wins (graceful-cycle preserved). Manual,
     * pre_restore, and auto-rehydrate remain below the tier (unchanged).
     *
     * The SQL query orders by `(kind IN ('auto-pre-down','auto-periodic')) DESC,
     * created_at DESC, rowid DESC`. The in-memory loop validates each candidate and
     * skips snapshots with corrupted JSON or missing topology metadata, returning
     * the first usable row. Returns null when no usable snapshot exists.
     *
     * Distinct from `findLatestUsableSnapshot` (rig-repository.ts, L2): that
     * helper requires at least one persisted resume token and is consumed by
     * the lifecycle projection. This helper only requires structural metadata
     * `RestoreOrchestrator.restore` actually inspects, so terminal-only or
     * resume-tokenless rigs still resolve.
     */
    findLatestRestoreUsable(rigId) {
        const rows = this.db
            .prepare("SELECT * FROM snapshots WHERE rig_id = ? ORDER BY (kind IN ('auto-pre-down', 'auto-periodic')) DESC, created_at DESC, rowid DESC")
            .all(rigId);
        for (const row of rows) {
            let data;
            try {
                data = JSON.parse(row.data);
            }
            catch {
                continue;
            }
            if (!isRestoreUsableSnapshotData(data))
                continue;
            return this.rowToSnapshot(row);
        }
        return null;
    }
    /** Resolve an exact or policy-ranked restore source and return the evidence
     * needed to make that decision legible before any restore mutation. */
    selectRestoreUsable(rigId, snapshotId, nowMs = Date.now()) {
        let snapshot;
        if (snapshotId) {
            const row = this.db.prepare("SELECT * FROM snapshots WHERE id = ?").get(snapshotId);
            if (!row)
                return { ok: false, code: "snapshot_not_found", message: `Snapshot ${snapshotId} not found` };
            if (row.rig_id !== rigId) {
                return { ok: false, code: "snapshot_wrong_rig", message: `Snapshot ${snapshotId} belongs to rig ${row.rig_id}, not ${rigId}` };
            }
            snapshot = this.restoreUsableRow(row);
            if (!snapshot) {
                return { ok: false, code: "snapshot_unusable", message: `Snapshot ${snapshotId} is not structurally restore-usable` };
            }
        }
        else {
            snapshot = this.findLatestRestoreUsable(rigId);
            if (!snapshot)
                return { ok: false, code: "no_usable_snapshot", message: `No usable snapshot for rig ${rigId}` };
        }
        // Equal second-resolution timestamps still have an insertion order. Scan
        // only newer rows, retaining restore's tolerant parse for damaged captures.
        const candidates = this.db.prepare("SELECT * FROM snapshots WHERE rig_id = ? ORDER BY created_at DESC, rowid DESC")
            .all(rigId);
        const selectedIndex = candidates.findIndex((candidate) => candidate.id === snapshot.id);
        // A concurrent pruner can remove the selected row after it was read. Its
        // insertion position is then unknown, so only strictly newer timestamps count.
        const newerRows = selectedIndex < 0
            ? candidates.filter((row) => parseSqliteUtcMs(row.created_at) > parseSqliteUtcMs(snapshot.createdAt))
            : candidates.slice(0, selectedIndex);
        const newer = newerRows.flatMap((row) => {
            const candidate = this.restoreUsableRow(row);
            return candidate ? [candidate] : [];
        })
            .find((candidate) => isRestoreUsableSnapshotData(candidate.data));
        const mode = snapshotId ? "explicit" : "automatic";
        return {
            ok: true,
            snapshot,
            selection: {
                ...summarizeSnapshot(snapshot, nowMs),
                mode,
                rationale: mode === "explicit"
                    ? "operator selected this exact restore-usable snapshot"
                    : "automatic crash-insurance ranking prefers auto-pre-down/auto-periodic, then newest usable",
                newerUsableAlternative: newer ? summarizeSnapshot(newer, nowMs) : null,
            },
        };
    }
    getLatestSnapshot(rigId) {
        const row = this.db
            .prepare("SELECT * FROM snapshots WHERE rig_id = ? ORDER BY created_at DESC LIMIT 1")
            .get(rigId);
        return row ? this.rowToSnapshot(row) : null;
    }
    listSnapshots(rigId, opts) {
        let sql = "SELECT * FROM snapshots WHERE rig_id = ?";
        const params = [rigId];
        if (opts?.kind) {
            sql += " AND kind = ?";
            params.push(opts.kind);
        }
        sql += " ORDER BY created_at DESC, rowid DESC";
        if (opts?.limit) {
            sql += " LIMIT ?";
            params.push(opts.limit);
        }
        const rows = this.db.prepare(sql).all(...params);
        return rows.map((r) => this.rowToSnapshot(r));
    }
    pruneSnapshots(rigId, keepCount) {
        // Select the small keeper set in SQLite: expanding every discarded ID into
        // a parameter makes retention fail above SQLite's variable-number limit.
        return this.db.prepare(`DELETE FROM snapshots
      WHERE rig_id = ? AND id NOT IN (
        SELECT id FROM snapshots WHERE rig_id = ?
        ORDER BY created_at DESC, rowid DESC LIMIT ?
      )`).run(rigId, rigId, keepCount).changes;
    }
    /** OPR.0.3.4.9 — kind-scoped retention. Keeps the newest `keepCount` rows
     *  of the given kind and deletes only older rows of THAT kind. Never touches
     *  other kinds. Hard floor: keepCount >= 1 (never prune to zero). */
    pruneSnapshotsByKind(rigId, kind, keepCount) {
        const effectiveKeep = Math.max(1, keepCount);
        return this.db.prepare(`DELETE FROM snapshots
      WHERE rig_id = ? AND kind = ? AND id NOT IN (
        SELECT id FROM snapshots WHERE rig_id = ? AND kind = ?
        ORDER BY created_at DESC, rowid DESC LIMIT ?
      )`).run(rigId, kind, rigId, kind, effectiveKeep).changes;
    }
    restoreUsableRow(row) {
        let snapshot;
        try {
            snapshot = this.rowToSnapshot(row);
        }
        catch (err) {
            if (err instanceof SyntaxError)
                return null;
            throw err;
        }
        return isRestoreUsableSnapshotData(snapshot.data) ? snapshot : null;
    }
    rowToSnapshot(row) {
        return {
            id: row.id,
            rigId: row.rig_id,
            kind: row.kind,
            status: row.status,
            data: JSON.parse(row.data),
            createdAt: row.created_at,
        };
    }
}
export function summarizeSnapshot(snapshot, nowMs = Date.now()) {
    return {
        snapshotId: snapshot.id,
        kind: snapshot.kind,
        createdAt: snapshot.createdAt,
        ageMs: Math.max(0, nowMs - parseSqliteUtcMs(snapshot.createdAt)),
    };
}
// Validates `SnapshotData` carries the minimum structural metadata
// `RestoreOrchestrator.restore`'s pre-validation requires.
//
// Per the L3b orch amendment: validate against actual SnapshotData. There is
// NO `data.bindings[]` field and `Session` has NO `runtime` field (runtime
// lives on nodes). Resume tokens are NOT required (resume-tokenless rigs are
// still restorable).
//
// Required:
//   - rig with non-empty id
//   - nodes array (may be empty — restore handles empty topologies)
//   - edges array (may be empty)
//   - sessions array (may be empty — `validatePreRestore` accepts empty)
//   - checkpoints object
//
// When sessions is non-empty, each session must have a non-empty sessionName
// and nodeId so node linkage can be resolved during restore. We do NOT check
// session.runtime because that field doesn't exist on Session (orch amendment).
export function isRestoreUsableSnapshotData(data) {
    if (!data || typeof data !== "object")
        return false;
    const d = data;
    if (!d.rig || typeof d.rig.id !== "string" || d.rig.id.length === 0)
        return false;
    if (!Array.isArray(d.nodes))
        return false;
    if (!Array.isArray(d.edges))
        return false;
    if (!Array.isArray(d.sessions))
        return false;
    if (!d.checkpoints || typeof d.checkpoints !== "object")
        return false;
    const nodeIds = new Set();
    for (const node of d.nodes) {
        if (!node || typeof node !== "object")
            return false;
        if (typeof node.id !== "string" || node.id.length === 0)
            return false;
        if (typeof node.logicalId !== "string" || node.logicalId.length === 0)
            return false;
        if (nodeIds.has(node.id))
            return false;
        nodeIds.add(node.id);
    }
    for (const s of d.sessions) {
        if (!s || typeof s !== "object")
            return false;
        if (typeof s.sessionName !== "string" || s.sessionName.length === 0)
            return false;
        if (typeof s.nodeId !== "string" || s.nodeId.length === 0)
            return false;
    }
    if (d.topologyRoster !== undefined) {
        const roster = d.topologyRoster;
        if (!roster || typeof roster !== "object" || Array.isArray(roster))
            return false;
        const allowedSources = new Set(["materialized_topology", "operator_explicit", "legacy_current_nodes"]);
        if (roster.version !== 1 || !allowedSources.has(roster.source) || !Array.isArray(roster.intendedNodeIds))
            return false;
        if (!roster.intendedNodeIds.every((nodeId) => typeof nodeId === "string" && nodeId.length > 0))
            return false;
        if (new Set(roster.intendedNodeIds).size !== roster.intendedNodeIds.length)
            return false;
        if (roster.intendedNodeIds.some((nodeId) => !nodeIds.has(nodeId)))
            return false;
    }
    if (d.activeOccupantsByNode !== undefined) {
        if (!d.activeOccupantsByNode || typeof d.activeOccupantsByNode !== "object" || Array.isArray(d.activeOccupantsByNode))
            return false;
        const intendedNodeIds = d.topologyRoster?.intendedNodeIds ?? [...nodeIds];
        if (intendedNodeIds.some((nodeId) => !(nodeId in d.activeOccupantsByNode)))
            return false;
        if (Object.keys(d.activeOccupantsByNode).some((nodeId) => !nodeIds.has(nodeId)))
            return false;
        const sessionsById = new Map(d.sessions.map((session) => [session.id, session]));
        for (const [nodeId, state] of Object.entries(d.activeOccupantsByNode)) {
            if (!state || typeof state !== "object")
                return false;
            if (state.kind === "absent")
                continue;
            if (state.kind === "resolved" && typeof state.sessionId === "string" && state.sessionId.length > 0) {
                if (sessionsById.get(state.sessionId)?.nodeId !== nodeId)
                    return false;
                continue;
            }
            if (state.kind === "ambiguous" && Array.isArray(state.candidateIds)) {
                if (state.candidateIds.length < 2 || new Set(state.candidateIds).size !== state.candidateIds.length)
                    return false;
                if (state.candidateIds.some((id) => typeof id !== "string" || id.length === 0 || sessionsById.get(id)?.nodeId !== nodeId))
                    return false;
                continue;
            }
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=snapshot-repository.js.map