import { resolveActiveOccupantRow } from "./active-occupant.js";
import { resolve } from "node:path";
import { ulid } from "ulid";
import { deriveComposeProjectName } from "./compose-project-name.js";
import { mergeSeatEnv, parseStoredSeatEnv } from "./seat-env.js";
/** Shared row → usable-Snapshot mapping (single source of truth for the parse +
 *  the ≥1-resume-token usability rule), used by both the single-rig and the
 *  FS-1 W1.2 all-rigs batched reads so their semantics are byte-identical. */
function snapshotFromRowIfUsable(row) {
    let data;
    try {
        data = JSON.parse(row.data);
    }
    catch {
        return null;
    }
    // OPR.0.5.7.1 — usability is OCCUPANT truth, not any-historical-row truth:
    // a snapshot is usable iff at least one node RESOLVES to an active occupant
    // carrying a token (the same four-way ladder execution consumes). A
    // present-null/missing-key/dangling relation never counts — a historical
    // token on a non-occupant row must not read as recoverable.
    const sessions = data.sessions ?? [];
    const nodeIds = [...new Set(sessions.map((s) => s.nodeId))];
    const hasResolvedOccupantToken = nodeIds.some((nodeId) => {
        const resolution = resolveActiveOccupantRow(sessions, data.activeSessionIdByNode, nodeId);
        return resolution.kind === "resolved"
            && typeof resolution.session.resumeToken === "string"
            && resolution.session.resumeToken.length > 0;
    });
    if (!hasResolvedOccupantToken)
        return null;
    return {
        id: row.id,
        rigId: row.rig_id,
        kind: row.kind,
        status: row.status,
        data,
        createdAt: row.created_at,
    };
}
export function findLatestUsableSnapshot(db, rigId) {
    const row = db.prepare("SELECT * FROM snapshots WHERE rig_id = ? ORDER BY created_at DESC, id DESC LIMIT 1").get(rigId);
    if (!row)
        return null;
    return snapshotFromRowIfUsable(row);
}
/**
 * FS-1 W1.2 — the all-rigs batched form of `findLatestUsableSnapshot`: the
 * latest snapshot per rig in ONE query (same `created_at DESC, id DESC` order),
 * each mapped through the shared `snapshotFromRowIfUsable`. Rigs with no usable
 * snapshot are simply absent from the map (callers default to null). Rides the
 * arch-D1.1 sibling-audit `snapshots(rig_id, created_at)` index candidate.
 */
export function findLatestUsableSnapshotsForAllRigs(db) {
    const rows = db.prepare(`
    SELECT s.* FROM snapshots s
    WHERE s.id = (
      SELECT s2.id FROM snapshots s2 WHERE s2.rig_id = s.rig_id
      ORDER BY s2.created_at DESC, s2.id DESC LIMIT 1
    )
  `).all();
    const out = new Map();
    for (const row of rows) {
        const snap = snapshotFromRowIfUsable(row);
        if (snap)
            out.set(row.rig_id, snap);
    }
    return out;
}
/**
 * SQL condition fragment for the archive filter on a column (e.g. "archived_at"
 * or the aliased "r.archived_at"). Returns null when no filter applies
 * (includeArchived = include everything). Default (no filter) excludes archived.
 */
export function archiveWhereClause(col, filter) {
    if (filter?.archivedOnly)
        return `${col} IS NOT NULL`;
    if (filter?.includeArchived)
        return null;
    return `${col} IS NULL`;
}
export class RigRepository {
    db;
    /** OPR.0.5.6.24 — born-armed (advisor-ruled birth-property principle):
     *  protection arms in the same act that creates the rig. Wired at startup;
     *  optional so repo construction stays dependency-free. */
    onRigCreated;
    constructor(db) {
        this.db = db;
    }
    createRig(name, installRoot) {
        const id = ulid();
        if (installRoot !== undefined) {
            this.db.prepare("INSERT INTO rigs (id, name, install_root) VALUES (?, ?, ?)")
                .run(id, name, installRoot);
        }
        else {
            this.db.prepare("INSERT INTO rigs (id, name) VALUES (?, ?)").run(id, name);
        }
        const rig = this.rowToRig(this.db.prepare("SELECT * FROM rigs WHERE id = ?").get(id));
        this.onRigCreated?.(rig);
        return rig;
    }
    /** Canonical bundle materialization folder, independent of seats' working directories. */
    getRigInstallRoot(rigId) {
        const row = this.db.prepare("SELECT * FROM rigs WHERE id = ?").get(rigId);
        return row?.install_root ?? null;
    }
    /**
     * PL-007 Workspace Primitive — persist the typed workspace block on the
     * rigs row. Stored as JSON in `workspace_json` (migration 038). Pass
     * null to clear. Older test fixtures that bypass the canonical migration
     * list don't have the column; setter is a no-op in that case (the
     * caller's contract is "best-effort persistence"). Whoami / node-inventory
     * read this column to surface the rig's workspace block alongside cwd.
     */
    setRigWorkspace(rigId, workspace) {
        if (!this.hasRigColumn("workspace_json"))
            return;
        const json = workspace ? JSON.stringify(workspace) : null;
        this.db.prepare("UPDATE rigs SET workspace_json = ?, updated_at = ? WHERE id = ?")
            .run(json, new Date().toISOString(), rigId);
    }
    /** PL-007 — read the persisted workspace block for a rig. */
    getRigWorkspace(rigId) {
        if (!this.hasRigColumn("workspace_json"))
            return null;
        const row = this.db.prepare("SELECT workspace_json FROM rigs WHERE id = ?")
            .get(rigId);
        if (!row || !row.workspace_json)
            return null;
        try {
            return JSON.parse(row.workspace_json);
        }
        catch {
            return null;
        }
    }
    setRigNonInterruptive(rigId, enabled) {
        if (!this.hasRigColumn("non_interruptive"))
            return;
        this.db.prepare("UPDATE rigs SET non_interruptive = ?, updated_at = ? WHERE id = ?")
            .run(enabled ? 1 : 0, new Date().toISOString(), rigId);
    }
    getRigNonInterruptive(rigId) {
        if (!this.hasRigColumn("non_interruptive"))
            return false;
        const row = this.db.prepare("SELECT non_interruptive FROM rigs WHERE id = ?")
            .get(rigId);
        return row?.non_interruptive === 1;
    }
    /** Persist the rig-level `env:` block from the spec, or null to clear. */
    setRigEnv(rigId, env) {
        if (!this.hasRigColumn("env_json"))
            return;
        this.db.prepare("UPDATE rigs SET env_json = ?, updated_at = ? WHERE id = ?")
            .run(env ? JSON.stringify(env) : null, new Date().toISOString(), rigId);
    }
    getRigEnv(rigId) {
        if (!this.hasRigColumn("env_json"))
            return null;
        const row = this.db.prepare("SELECT env_json FROM rigs WHERE id = ?")
            .get(rigId);
        return parseStoredSeatEnv(row?.env_json);
    }
    /** What a seat's process gets: its rig's `env:` with the member's own `env:` over it. A launch,
     *  a restore and a handover successor all read this, so they cannot disagree. */
    getEffectiveSeatEnv(nodeId) {
        if (!this.hasNodeColumn("env_json"))
            return {};
        const row = this.db.prepare("SELECT rig_id, env_json FROM nodes WHERE id = ?")
            .get(nodeId);
        if (!row)
            return {};
        return mergeSeatEnv(this.getRigEnv(row.rig_id), parseStoredSeatEnv(row.env_json));
    }
    /** OPR.0.4.8.3 Seam B — persist a rig's attached permission_policy REF (builtin:<name> or a
     *  spec-relative custom path), or null to clear. Mirrors setRigWorkspace (migration 056). */
    setRigPermissionPolicy(rigId, permissionPolicy) {
        if (!this.hasRigColumn("permission_policy"))
            return;
        this.db.prepare("UPDATE rigs SET permission_policy = ?, updated_at = ? WHERE id = ?")
            .run(permissionPolicy ?? null, new Date().toISOString(), rigId);
    }
    /** OPR.0.4.8.3 Seam B — read the persisted rig-level permission_policy REF (null when none). */
    getRigPermissionPolicy(rigId) {
        if (!this.hasRigColumn("permission_policy"))
            return null;
        const row = this.db.prepare("SELECT permission_policy FROM rigs WHERE id = ?")
            .get(rigId);
        return row?.permission_policy ?? null;
    }
    /** #25 — persist the rig's selected Claude managed-block file (migration 085), or null for
     *  the CLAUDE.md default. Mirrors setRigPermissionPolicy. */
    setRigClaudeManagedBlockFile(rigId, file) {
        if (!this.hasRigColumn("claude_managed_block_file"))
            return;
        this.db.prepare("UPDATE rigs SET claude_managed_block_file = ?, updated_at = ? WHERE id = ?")
            .run(file ?? null, new Date().toISOString(), rigId);
    }
    /** #25 — the rig's selected Claude managed-block file, or null when it uses the default. */
    getRigClaudeManagedBlockFile(rigId) {
        if (!this.hasRigColumn("claude_managed_block_file"))
            return null;
        const row = this.db.prepare("SELECT claude_managed_block_file FROM rigs WHERE id = ?")
            .get(rigId);
        return row?.claude_managed_block_file ?? null;
    }
    /** Seam B Guard-F1 — persist the RIG-level resolved attachment provenance (migration 058).
     *  declaringDir = the ORIGINAL declaring RigSpec dir; consumers must never re-resolve the
     *  raw relative ref against an unrelated operation root. No-op on pre-058 fixture DBs. */
    setRigPolicyProvenance(rigId, provenance) {
        if (!this.hasRigColumn("rig_policy_launch_posture"))
            return;
        this.db.prepare("UPDATE rigs SET rig_policy_origin = ?, rig_policy_resolved_target = ?, rig_policy_declaring_dir = ?, rig_policy_launch_posture = ?, updated_at = ? WHERE id = ?").run(provenance.origin, provenance.resolvedTarget, provenance.declaringDir, provenance.launchPosture, new Date().toISOString(), rigId);
    }
    /** Seam B Guard-F1 — read the rig-level resolved attachment provenance (null when none). */
    getRigPolicyProvenance(rigId) {
        if (!this.hasRigColumn("rig_policy_launch_posture"))
            return null;
        const row = this.db.prepare("SELECT permission_policy, rig_policy_origin, rig_policy_resolved_target, rig_policy_declaring_dir, rig_policy_launch_posture FROM rigs WHERE id = ?").get(rigId);
        if (!row || row.rig_policy_origin == null || row.rig_policy_launch_posture == null)
            return null;
        return {
            origin: row.rig_policy_origin,
            resolvedTarget: row.rig_policy_resolved_target,
            declaringDir: row.rig_policy_declaring_dir,
            launchPosture: row.rig_policy_launch_posture,
            rigRef: row.permission_policy,
        };
    }
    /** OPR.0.4.8.3 Seam B (R2, dev-guard ruling) — persist a node's RESOLVED policy attachment
     *  provenance (restart-stable: origin + resolved target + declaring dir + launch posture).
     *  Builtins carry resolvedTarget=null until the packaging leg's canonical path is ruled
     *  (PM lane c76c7153) — never a `builtin:<name>` echo. No-op on pre-057 fixture DBs. */
    setNodePolicyProvenance(nodeId, provenance) {
        if (!this.hasNodeColumn("policy_launch_posture"))
            return;
        this.db.prepare("UPDATE nodes SET policy_origin = ?, policy_resolved_target = ?, policy_declaring_dir = ?, policy_launch_posture = ? WHERE id = ?").run(provenance.origin, provenance.resolvedTarget, provenance.declaringDir, provenance.launchPosture, nodeId);
    }
    /** Re-point an EXISTING seat's own permission_policy REF (`rig policy apply --seat`); the caller
     *  writes its resolved provenance through setNodePolicyProvenance in the same transaction. Restore,
     *  resume and launches that read the stored seat use that provenance. A later launch from a spec that
     *  declares a policy rewrites the provenance but not this ref, so the two can then differ: this ref
     *  is what `rig export` emits, not necessarily the policy the seat launched with. */
    setNodePermissionPolicy(nodeId, permissionPolicy) {
        if (!this.hasNodeColumn("permission_policy"))
            return;
        this.db.prepare("UPDATE nodes SET permission_policy = ? WHERE id = ?").run(permissionPolicy, nodeId);
    }
    /** Seam B (R2) — read a node's persisted policy provenance; null when none attached
     *  (or pre-057 DB). Restore consumers re-derive posture from this without the spec. */
    getNodePolicyProvenance(nodeId) {
        if (!this.hasNodeColumn("policy_launch_posture"))
            return null;
        const row = this.db.prepare("SELECT permission_policy, policy_origin, policy_resolved_target, policy_declaring_dir, policy_launch_posture FROM nodes WHERE id = ?").get(nodeId);
        if (!row || row.policy_origin == null || row.policy_launch_posture == null)
            return null;
        return {
            origin: row.policy_origin,
            resolvedTarget: row.policy_resolved_target,
            declaringDir: row.policy_declaring_dir,
            launchPosture: row.policy_launch_posture,
            nodeRef: row.permission_policy,
        };
    }
    /** PL-007 — defensive column probe on rigs (migration 038's
     *  workspace_json is absent in legacy test fixtures). */
    hasRigColumn(columnName) {
        try {
            return this.db.prepare("PRAGMA table_info(rigs)").all()
                .some((row) => row.name === columnName);
        }
        catch {
            return false;
        }
    }
    addNode(rigId, logicalId, opts) {
        // Same-rig guard for podId
        if (opts?.podId) {
            const pod = this.db.prepare("SELECT rig_id FROM pods WHERE id = ?").get(opts.podId);
            if (!pod)
                throw new Error(`Pod not found: ${opts.podId}`);
            if (pod.rig_id !== rigId)
                throw new Error("Pod belongs to a different rig");
        }
        const id = ulid();
        if (this.hasNodeColumn("codex_config_profile") && this.hasNodeColumn("permission_policy")) {
            // OPR.0.4.8.3 Seam B: both ALTER-added optional columns present (migrations 022 + 055; 055
            // runs after 022, so a permission_policy column implies a codex_config_profile column).
            this.db
                .prepare(`INSERT INTO nodes (id, rig_id, logical_id, role, runtime, model, codex_config_profile, permission_policy, cwd, surface_hint, workspace, restore_policy, package_refs,
           pod_id, agent_ref, profile, label, resolved_spec_name, resolved_spec_version, resolved_spec_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(id, rigId, logicalId, opts?.role ?? null, opts?.runtime ?? null, opts?.model ?? null, opts?.codexConfigProfile ?? null, opts?.permissionPolicy ?? null, opts?.cwd ?? null, opts?.surfaceHint ?? null, opts?.workspace ?? null, opts?.restorePolicy ?? null, opts?.packageRefs ? JSON.stringify(opts.packageRefs) : null, opts?.podId ?? null, opts?.agentRef ?? null, opts?.profile ?? null, opts?.label ?? null, opts?.resolvedSpecName ?? null, opts?.resolvedSpecVersion ?? null, opts?.resolvedSpecHash ?? null);
        }
        else if (this.hasNodeColumn("codex_config_profile")) {
            this.db
                .prepare(`INSERT INTO nodes (id, rig_id, logical_id, role, runtime, model, codex_config_profile, cwd, surface_hint, workspace, restore_policy, package_refs,
           pod_id, agent_ref, profile, label, resolved_spec_name, resolved_spec_version, resolved_spec_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(id, rigId, logicalId, opts?.role ?? null, opts?.runtime ?? null, opts?.model ?? null, opts?.codexConfigProfile ?? null, opts?.cwd ?? null, opts?.surfaceHint ?? null, opts?.workspace ?? null, opts?.restorePolicy ?? null, opts?.packageRefs ? JSON.stringify(opts.packageRefs) : null, opts?.podId ?? null, opts?.agentRef ?? null, opts?.profile ?? null, opts?.label ?? null, opts?.resolvedSpecName ?? null, opts?.resolvedSpecVersion ?? null, opts?.resolvedSpecHash ?? null);
        }
        else {
            this.db
                .prepare(`INSERT INTO nodes (id, rig_id, logical_id, role, runtime, model, cwd, surface_hint, workspace, restore_policy, package_refs,
           pod_id, agent_ref, profile, label, resolved_spec_name, resolved_spec_version, resolved_spec_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(id, rigId, logicalId, opts?.role ?? null, opts?.runtime ?? null, opts?.model ?? null, opts?.cwd ?? null, opts?.surfaceHint ?? null, opts?.workspace ?? null, opts?.restorePolicy ?? null, opts?.packageRefs ? JSON.stringify(opts.packageRefs) : null, opts?.podId ?? null, opts?.agentRef ?? null, opts?.profile ?? null, opts?.label ?? null, opts?.resolvedSpecName ?? null, opts?.resolvedSpecVersion ?? null, opts?.resolvedSpecHash ?? null);
        }
        if (opts?.sessionSource && this.hasNodeColumn("session_source_json")) {
            this.db.prepare("UPDATE nodes SET session_source_json = ? WHERE id = ?")
                .run(JSON.stringify(opts.sessionSource), id);
        }
        if (opts?.effort && this.hasNodeColumn("effort")) {
            this.db.prepare("UPDATE nodes SET effort = ? WHERE id = ?")
                .run(opts.effort, id);
        }
        if (opts?.env && this.hasNodeColumn("env_json")) {
            this.db.prepare("UPDATE nodes SET env_json = ? WHERE id = ?")
                .run(JSON.stringify(opts.env), id);
        }
        return this.rowToNode(this.db.prepare("SELECT * FROM nodes WHERE id = ?").get(id));
    }
    /** S5 (OPR.0.5.4.7) — the first supported nodes.model write (the inventory was insert-only;
     *  KI-5.3-9). Every managed resume/successor launch reads node.model at call time, so this
     *  UPDATE is the complete persistence half of set-model. Returns whether a row changed. */
    setNodeModel(nodeId, model) {
        const result = this.db
            .prepare("UPDATE nodes SET model = ? WHERE id = ?")
            .run(model, nodeId);
        return result.changes > 0;
    }
    setNodeEffort(nodeId, effort) {
        if (!this.hasNodeColumn("effort"))
            return false;
        const result = this.db
            .prepare("UPDATE nodes SET effort = ? WHERE id = ?")
            .run(effort, nodeId);
        return result.changes > 0;
    }
    /** OPR.0.7.0.7: write or clear (null) a seat's explicit effort choice. Returns false when
     *  the column isn't available or no row matched, so a caller never reports a change from it. */
    setNodeEffortChoice(nodeId, choice) {
        if (!this.hasNodeColumn("effort_choice"))
            return false;
        return this.db.prepare("UPDATE nodes SET effort_choice = ? WHERE id = ?")
            .run(choice, nodeId).changes > 0;
    }
    clearNodeEffort(nodeId) {
        if (!this.hasNodeColumn("effort"))
            return false;
        const result = this.db
            .prepare("UPDATE nodes SET effort = NULL WHERE id = ?")
            .run(nodeId);
        return result.changes > 0;
    }
    addEdge(rigId, sourceId, targetId, kind) {
        const id = ulid();
        this.db
            .prepare("INSERT INTO edges (id, rig_id, source_id, target_id, kind) VALUES (?, ?, ?, ?, ?)")
            .run(id, rigId, sourceId, targetId, kind);
        return this.rowToEdge(this.db.prepare("SELECT * FROM edges WHERE id = ?").get(id));
    }
    getRig(rigId) {
        const rigRow = this.db
            .prepare("SELECT * FROM rigs WHERE id = ?")
            .get(rigId);
        if (!rigRow)
            return null;
        const nodeRows = this.db
            .prepare("SELECT * FROM nodes WHERE rig_id = ? ORDER BY created_at")
            .all(rigId);
        const edgeRows = this.db
            .prepare("SELECT * FROM edges WHERE rig_id = ?")
            .all(rigId);
        const nodes = nodeRows.map((row) => {
            const bindingRow = this.db
                .prepare("SELECT * FROM bindings WHERE node_id = ?")
                .get(row.id);
            return {
                ...this.rowToNode(row),
                binding: bindingRow ? this.rowToBinding(bindingRow) : null,
            };
        });
        return {
            rig: this.rowToRig(rigRow),
            nodes,
            edges: edgeRows.map((r) => this.rowToEdge(r)),
        };
    }
    listRigs(filter, observe) {
        const cond = archiveWhereClause("archived_at", filter);
        const where = cond ? `WHERE ${cond}` : "";
        let rows;
        try {
            observe?.("begin");
        }
        catch { /* Best-effort measurement only. */ }
        try {
            rows = this.db.prepare(`SELECT * FROM rigs ${where} ORDER BY created_at`).all();
        }
        catch (error) {
            try {
                observe?.("end", true);
            }
            catch { /* Preserve the actual query error. */ }
            throw error;
        }
        try {
            observe?.("end", false);
        }
        catch { /* Preserve the query result. */ }
        return rows.map((r) => this.rowToRig(r));
    }
    /**
     * Returns the latest snapshot for this rig with at least one non-null resume token,
     * or null if no usable snapshot exists. Used by the lifecycle projection to derive
     * `recoverable` state.
     */
    findLatestUsableSnapshot(rigId) {
        return findLatestUsableSnapshot(this.db, rigId);
    }
    findRigsByName(name) {
        const rows = this.db
            .prepare("SELECT * FROM rigs WHERE name = ? ORDER BY created_at")
            .all(name);
        return rows.map((r) => this.rowToRig(r));
    }
    /** #174: seat-ref resolution sees only unarchived rigs, as default reads do since migration 042. */
    findUnarchivedRigsByName(name) {
        const archived = this.hasRigColumn("archived_at") ? " AND archived_at IS NULL" : "";
        const rows = this.db
            .prepare(`SELECT * FROM rigs WHERE name = ?${archived} ORDER BY created_at`)
            .all(name);
        return rows.map((r) => this.rowToRig(r));
    }
    getRigSummaries(filter) {
        const cond = archiveWhereClause("r.archived_at", filter);
        const where = cond ? `WHERE ${cond}` : "";
        const rows = this.db.prepare(`
      SELECT
        r.id,
        r.name,
        r.archived_at AS archived_at,
        (SELECT COUNT(*) FROM nodes n WHERE n.rig_id = r.id) AS node_count,
        EXISTS(SELECT 1 FROM rig_services rs WHERE rs.rig_id = r.id) AS has_services,
        ls.id AS latest_snapshot_id,
        ls.created_at AS latest_snapshot_at
      FROM rigs r
      LEFT JOIN snapshots ls ON ls.id = (
        SELECT s2.id FROM snapshots s2
        WHERE s2.rig_id = r.id
        ORDER BY s2.created_at DESC, s2.id DESC
        LIMIT 1
      )
      ${where}
      ORDER BY r.created_at
    `).all();
        return rows.map((r) => ({
            id: r.id,
            name: r.name,
            nodeCount: r.node_count,
            hasServices: r.has_services === 1,
            latestSnapshotAt: r.latest_snapshot_at,
            latestSnapshotId: r.latest_snapshot_id,
            archivedAt: r.archived_at,
        }));
    }
    /**
     * OPR.0.3.3.19 - soft-archive a rig: sets `archived_at`. The rigs row,
     * topology rows, and snapshots are all RETAINED (this is NOT the delete
     * path - contrast deleteRig). Returns false if the rig was already archived.
     */
    archiveRig(rigId) {
        const result = this.db
            .prepare("UPDATE rigs SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND archived_at IS NULL")
            .run(rigId);
        return result.changes > 0;
    }
    /** OPR.0.3.3.19 - reverse archive: clears `archived_at`. Returns false if not archived. */
    unarchiveRig(rigId) {
        const result = this.db
            .prepare("UPDATE rigs SET archived_at = NULL, updated_at = datetime('now') WHERE id = ? AND archived_at IS NOT NULL")
            .run(rigId);
        return result.changes > 0;
    }
    deleteRig(rigId) {
        this.db.prepare("DELETE FROM rigs WHERE id = ?").run(rigId);
    }
    deleteNode(nodeId) {
        this.db.prepare("DELETE FROM nodes WHERE id = ?").run(nodeId);
    }
    setServicesRecord(rigId, record) {
        const now = new Date().toISOString();
        const composeFile = resolve(record.rigRoot, record.composeFile);
        const rig = this.db.prepare("SELECT 1 AS present FROM rigs WHERE id = ?").get(rigId);
        if (!rig)
            throw new Error(`Rig not found: ${rigId}`);
        // Keep the fallback aligned with bootstrap's unique, stable rig-ID default.
        const projectName = record.projectName ?? this.getServicesRecord(rigId)?.projectName ?? deriveComposeProjectName(rigId);
        this.db.prepare(`
      INSERT INTO rig_services (
        rig_id,
        kind,
        spec_json,
        rig_root,
        compose_file,
        project_name,
        latest_receipt_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(rig_id) DO UPDATE SET
        kind = excluded.kind,
        spec_json = excluded.spec_json,
        rig_root = excluded.rig_root,
        compose_file = excluded.compose_file,
        project_name = excluded.project_name,
        latest_receipt_json = excluded.latest_receipt_json,
        updated_at = excluded.updated_at
    `).run(rigId, record.kind, record.specJson, record.rigRoot, composeFile, projectName, record.latestReceiptJson ?? null, now, now);
        const stored = this.db.prepare("SELECT * FROM rig_services WHERE rig_id = ?").get(rigId);
        if (!stored)
            throw new Error(`Failed to persist services record for rig ${rigId}`);
        return this.rowToServicesRecord(stored);
    }
    /** A retained generation must not tear down a live generation's project. */
    getLiveServicesSuccessor(rigId, projectName) {
        if (!this.hasRigColumn("archived_at"))
            return null;
        return this.db.prepare(`
      SELECT r.id, r.name FROM rig_services s JOIN rigs r ON r.id = s.rig_id
      JOIN rigs predecessor ON predecessor.id = ?
      WHERE s.project_name = ? AND r.id != predecessor.id
        AND predecessor.archived_at IS NOT NULL AND r.archived_at IS NULL
        AND r.name = predecessor.name
      ORDER BY r.created_at DESC LIMIT 1
    `).get(rigId, projectName) ?? null;
    }
    getServicesRecord(rigId) {
        const row = this.db.prepare("SELECT * FROM rig_services WHERE rig_id = ?").get(rigId);
        return row ? this.rowToServicesRecord(row) : null;
    }
    updateServicesReceipt(rigId, latestReceiptJson) {
        const now = new Date().toISOString();
        const result = this.db.prepare(`
      UPDATE rig_services
      SET latest_receipt_json = ?, updated_at = ?
      WHERE rig_id = ?
    `).run(latestReceiptJson, now, rigId);
        if (result.changes === 0)
            return null;
        return this.getServicesRecord(rigId);
    }
    // -- Row-to-domain mappers --
    rowToRig(row) {
        return {
            id: row.id,
            name: row.name,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    rowToNode(row) {
        return {
            id: row.id,
            rigId: row.rig_id,
            logicalId: row.logical_id,
            role: row.role,
            runtime: row.runtime,
            model: row.model,
            effort: row.effort ?? null,
            effortChoice: row.effort_choice ?? null,
            codexConfigProfile: row.codex_config_profile ?? null,
            permissionPolicy: row.permission_policy ?? null,
            env: parseStoredSeatEnv(row.env_json),
            cwd: row.cwd,
            surfaceHint: row.surface_hint ?? null,
            workspace: row.workspace ?? null,
            restorePolicy: row.restore_policy ?? null,
            packageRefs: row.package_refs ? JSON.parse(row.package_refs) : [],
            podId: row.pod_id ?? null,
            agentRef: row.agent_ref ?? null,
            profile: row.profile ?? null,
            label: row.label ?? null,
            sessionSource: row.session_source_json
                ? JSON.parse(row.session_source_json)
                : null,
            resolvedSpecName: row.resolved_spec_name ?? null,
            resolvedSpecVersion: row.resolved_spec_version ?? null,
            resolvedSpecHash: row.resolved_spec_hash ?? null,
            occupantLifecycle: row.occupant_lifecycle ?? null,
            continuityOutcome: row.continuity_outcome ?? null,
            handoverResult: row.handover_result ?? null,
            previousOccupant: row.previous_occupant ?? null,
            handoverAt: row.handover_at ?? null,
            createdAt: row.created_at,
        };
    }
    rowToEdge(row) {
        return {
            id: row.id,
            rigId: row.rig_id,
            sourceId: row.source_id,
            targetId: row.target_id,
            kind: row.kind,
            createdAt: row.created_at,
        };
    }
    rowToBinding(row) {
        return {
            id: row.id,
            nodeId: row.node_id,
            attachmentType: row.attachment_type ?? "tmux",
            tmuxSession: row.tmux_session,
            tmuxWindow: row.tmux_window,
            tmuxPane: row.tmux_pane,
            externalSessionName: row.external_session_name ?? null,
            cmuxWorkspace: row.cmux_workspace,
            cmuxSurface: row.cmux_surface,
            updatedAt: row.updated_at,
        };
    }
    rowToServicesRecord(row) {
        return {
            rigId: row.rig_id,
            kind: row.kind,
            specJson: row.spec_json,
            rigRoot: row.rig_root,
            composeFile: row.compose_file,
            projectName: row.project_name,
            latestReceiptJson: row.latest_receipt_json ?? null,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    hasNodeColumn(columnName) {
        return this.db.prepare("PRAGMA table_info(nodes)").all()
            .some((row) => row.name === columnName);
    }
}
//# sourceMappingURL=rig-repository.js.map