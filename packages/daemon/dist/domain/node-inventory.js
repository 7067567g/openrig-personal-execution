import { decodeTime } from "ulid";
import { resolveActiveOccupantRow } from "./active-occupant.js";
import { identityVerdictConfirmsSessionMissing, identityVerdictDownranksRunning } from "./types.js";
import { SeatIdentityStore } from "./seat-identity-store.js";
import { buildOrientedMap } from "./startup-proof.js";
import { deriveDisplayActivity } from "./activity-taxonomy.js";
import { probeSessionActivity, mapPaneState } from "./session-transport.js";
import { findLatestUsableSnapshot, findLatestUsableSnapshotsForAllRigs } from "./rig-repository.js";
import { resolveNodeWorkspace } from "./workspace/workspace-resolver.js";
import { deriveCanonicalSessionName } from "./session-name.js";
import { buildNativeResumeCommand, buildCodexResumeCore } from "./native-resume-probe.js";
import { AppliedLaunchObservationStore } from "./applied-launch-observation-store.js";
import { tmuxAttachCommand } from "../adapters/tmux-server.js";
import { agentAppLabel } from "./agent-app-presets.js";
import { agentAppOf } from "./built-in-runtimes.js";
import { sessionAgentAppSelect } from "./session-registry.js";
// -- Helpers --
function computeResumeCommand(runtime, resumeToken, codexConfigProfile, codexDaemonOptOut) {
    return buildNativeResumeCommand(runtime, resumeToken, null, codexConfigProfile, codexDaemonOptOut);
}
const CODEX_DAEMON_CHOICE_NOT_RECORDED = "Not recorded whether this seat's last managed launch used --no-daemon. If `codex --help` lists --no-daemon, "
    + "add it right after `codex`, as the managed launch does.";
function computeRecoveryGuidance(input) {
    const { runtime, resumeToken, cwd, sessionName, codexConfigProfile, codexDaemonOptOut } = input;
    if (runtime === "claude-code") {
        const commands = [];
        const notes = [];
        if (resumeToken) {
            const cmd = buildNativeResumeCommand(runtime, resumeToken, sessionName);
            if (cmd)
                commands.push(cmd);
        }
        if (cwd) {
            commands.push(`cd ${cwd}`);
        }
        commands.push("claude --resume");
        if (sessionName) {
            notes.push(`Look for session name: ${sessionName}`);
        }
        notes.push("Choose the full conversation option, not summary.");
        return {
            summary: resumeToken
                ? "Try native Claude resume first, then fall back to the workspace-local picker if needed."
                : "No stored Claude resume token. Use the workspace-local Claude picker fallback.",
            commands,
            notes,
        };
    }
    if (runtime === "codex") {
        const commands = [];
        const notes = [];
        const daemonOptOut = codexDaemonOptOut === true;
        if (resumeToken) {
            commands.push(buildCodexResumeCore(resumeToken, codexConfigProfile, undefined, undefined, undefined, undefined, undefined, daemonOptOut));
        }
        if (cwd) {
            commands.push(`cd ${cwd}`);
        }
        if (!resumeToken) {
            commands.push(buildCodexResumeCore("", codexConfigProfile, true, undefined, undefined, undefined, undefined, daemonOptOut));
        }
        notes.push("Use workspace and recent prompt text to identify the right conversation.");
        if (codexConfigProfile) {
            notes.push(`Preserve Codex config profile: ${codexConfigProfile}`);
        }
        if (sessionName) {
            notes.push(`If the identity anchor was captured, the picker may include: ${sessionName}`);
        }
        if (codexDaemonOptOut === undefined) {
            notes.push(CODEX_DAEMON_CHOICE_NOT_RECORDED);
        }
        return {
            summary: resumeToken
                ? "Try native Codex resume first; the managed launch sets the explicit -s workspace-write floor flag unless a named config profile is present."
                : `No stored Codex resume token. Try codex${daemonOptOut ? " --no-daemon" : ""} -s workspace-write resume --last; the managed launch sets the explicit -s workspace-write floor flag unless a named config profile is present.`,
            commands,
            notes,
        };
    }
    return null;
}
function deriveNodeKind(runtime) {
    return runtime === "terminal" ? "infrastructure" : "agent";
}
/**
 * Derives per-node lifecycle state from session/restore truth plus the rig's latest
 * usable snapshot.
 *
 * Priorities (post-L2):
 *   attention_required  — restoreOutcome=failed AND tmux session is alive
 *                         (v0 proxy for the Claude resume-prompt case; revisited in L3).
 *   running             — sessionStatus=running.
 *   recoverable         — non-running session AND the latest usable snapshot has a
 *                         non-null resume token for THIS node.
 *   detached            — anything else (no session, exited, detached without resume token).
 *
 * Permission/IO failures upstream (L1 fail-closed) leave sessionStatus unchanged, so
 * the projection stays honest without misclassifying ambiguous probe failures.
 */
export function deriveNodeLifecycleState(input) {
    // L3: the explicit `attention_required` outcome (Claude resume-selection
    // prompt) and the L2 proxy (failed + alive tmux session) both surface as
    // lifecycleState=attention_required.
    if (input.startupStatus === "attention_required"
        || input.restoreOutcome === "attention_required"
        || (input.restoreOutcome === "failed" && input.sessionStatus === "running")) {
        return "attention_required";
    }
    if (input.sessionStatus === "running") {
        // OPR.0.4.3.19 — a `running` session projects `running` ONLY when its
        // pane process identity is verified (or not-yet-observed). An explicit
        // mismatch/pane-missing verdict down-ranks to attention_required so a
        // dead/orphaned/squatted pane never surfaces as healthy green.
        if (identityVerdictDownranksRunning(input.identityVerdict))
            return "attention_required";
        return "running";
    }
    if (input.usableSnapshot) {
        // OPR.0.5.7.1 — recoverability follows the RESOLVED occupant (the same
        // four-way ladder execution consumes), never the first matching row: a
        // token on a historical row the restore would refuse must not render
        // recoverable.
        const resolution = resolveActiveOccupantRow(input.usableSnapshot.data.sessions ?? [], input.usableSnapshot.data.activeSessionIdByNode, input.nodeId);
        if (resolution.kind === "resolved"
            && typeof resolution.session.resumeToken === "string"
            && resolution.session.resumeToken.length > 0) {
            return "recoverable";
        }
    }
    return "detached";
}
/**
 * Project occupant lifecycle using a verdict already gated to the current binding.
 * Confirmed session absence suppresses stored active state without rewriting it.
 */
function deriveOccupantLifecycle(row, identityVerdict) {
    if (row.occupant_lifecycle === "active" && identityVerdictConfirmsSessionMissing(identityVerdict)) {
        return "unknown";
    }
    if (row.occupant_lifecycle) {
        return row.occupant_lifecycle;
    }
    // OPR.0.4.3.19 — the derived `active` occupant requires a verified (or
    // not-yet-observed) pane identity, mirroring the lifecycleState gate.
    if (row.session_status === "running" && !identityVerdictDownranksRunning(identityVerdict?.verdict)) {
        return "active";
    }
    return "unknown";
}
function deriveContinuityOutcome(row, restore) {
    if (row.continuity_outcome) {
        return row.continuity_outcome;
    }
    const restoreOutcome = restore?.outcome ?? "n-a";
    if (restoreOutcome === "n-a")
        return null;
    // Acknowledgment and responsiveness clear attention, not conversation lineage.
    // Only the winning reconciliation's bound strict proof can infer a resume.
    // Explicit stored outcomes above remain historical facts, not fresh probes.
    if (restoreOutcome === "attention_required")
        return null;
    if (restoreOutcome === "operator_recovered") {
        return restore?.resumedRuntime === row.runtime ? "resumed" : null;
    }
    // OPR.0.3.4.2: a deliberate fresh-prime IS fresh continuity; awaiting-decision
    // means zero session, so no continuity outcome exists — null (the
    // restoreOutcome field carries the distinct term).
    if (restoreOutcome === "fresh-primed")
        return "fresh";
    if (restoreOutcome === "awaiting-decision")
        return null;
    return restoreOutcome;
}
function restoreKey(rigId, nodeId) {
    return JSON.stringify([rigId, nodeId]);
}
function eventObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value : undefined;
}
// One batch for either the selected rig or the fleet. Keep the outcome arm's
// existing partial indexes; exclude the rig-only index for starts (NULL node_id)
// so the node/type index can select them, with a scan fallback if it is absent.
// UNION ALL adds attempt boundaries without a per-node receipt query.
// Ascending seq with overwrites preserves the former newest-node, first-wins
// fold. Evidence is never borrowed
// from an older reconciliation when a newer acknowledgment wins.
function buildRestoreOutcomeMap(db, rigId) {
    const filter = rigId ? " AND rig_id = ?" : "";
    const startsFilter = rigId ? " AND +rig_id = ?" : "";
    const rows = db.prepare(`
    SELECT type, payload, seq, rig_id, node_id FROM events
      WHERE type IN ('restore.completed', 'restore.subset_completed', 'restore.outcome_reconciled')${filter}
    UNION ALL
    SELECT type, payload, seq, rig_id, node_id FROM events
      WHERE node_id IS NULL AND type = 'restore.started'${startsFilter}
    ORDER BY seq ASC
  `).all(...(rigId ? [rigId, rigId] : []));
    const map = new Map();
    const attempts = new Map();
    for (const row of rows) {
        let event;
        try {
            event = eventObject(JSON.parse(row.payload));
        }
        catch { /* Unknown evidence. */ }
        if (row.type === "restore.started") {
            // Even an unreadable new attempt prevents reuse of an earlier receipt.
            attempts.set(row.rig_id, { seq: row.seq, start: event, completed: false, outcomes: new Map() });
            continue;
        }
        const attempt = attempts.get(row.rig_id);
        if (row.type === "restore.completed" && attempt && !attempt.completed) {
            // Match the first completion within this attempt, as the receipt reader
            // does. Missing/corrupt receipts cannot become continuity proof.
            attempt.completed = true;
            const start = attempt.start;
            const result = eventObject(event?.result);
            const roster = start?.intendedRoster ?? result?.intendedRoster ?? result?.nodes;
            if (start?.rigId === row.rig_id && event?.rigId === row.rig_id
                && typeof start?.snapshotId === "string"
                && event?.snapshotId === start.snapshotId && result?.snapshotId === start.snapshotId
                && Array.isArray(result?.nodes) && Array.isArray(roster)) {
                const intended = new Set(roster.map((node) => node?.nodeId));
                for (const node of result.nodes) {
                    if (typeof node?.nodeId === "string" && intended.has(node.nodeId)) {
                        attempt.outcomes.set(node.nodeId, node.status);
                    }
                }
            }
        }
        if (!event)
            continue;
        if (row.type === "restore.outcome_reconciled") {
            if (typeof event.nodeId !== "string")
                continue;
            const evidence = eventObject(event.evidence);
            const strict = event.rigId === row.rig_id && event.nodeId === row.node_id
                && event.to === "operator_recovered" && (event.from === "failed" || event.from === "attention_required")
                && !!attempt && attempt.seq === event.attemptId && attempt.outcomes.get(event.nodeId) === event.from
                && evidence?.tmux === true && evidence.resumeTokenUsed === true && evidence.paneState === "usable"
                && (evidence.fgProcess === "claude" || evidence.fgProcess === "codex");
            map.set(restoreKey(row.rig_id, event.nodeId), {
                outcome: mapStatus(event.to),
                ...(strict ? { resumedRuntime: evidence.fgProcess === "claude" ? "claude-code" : "codex" } : {}),
            });
            continue;
        }
        if (!Array.isArray(event.result?.nodes))
            continue;
        for (const node of [...event.result.nodes].reverse()) {
            if (typeof node?.nodeId === "string") {
                map.set(restoreKey(row.rig_id, node.nodeId), { outcome: mapStatus(node.status) });
            }
        }
    }
    return map;
}
function mapStatus(status) {
    if (status === "resumed")
        return "resumed";
    if (status === "failed")
        return "failed";
    if (status === "rebuilt")
        return "rebuilt";
    if (status === "fresh")
        return "fresh";
    if (status === "fresh-primed")
        return "fresh-primed";
    if (status === "awaiting-decision")
        return "awaiting-decision";
    if (status === "attention_required")
        return "attention_required";
    if (status === "operator_recovered")
        return "operator_recovered";
    if (status === "checkpoint_written")
        return "rebuilt";
    if (status === "fresh_no_checkpoint")
        return "fresh";
    return "n-a";
}
function deriveHeldReason(db, rigId, nodeId, sessionStatus) {
    if (sessionStatus === "running")
        return null;
    const heldRow = db.prepare("SELECT seq, payload FROM events WHERE node_id = ? AND type = 'node.held' ORDER BY seq DESC LIMIT 1").get(nodeId);
    if (!heldRow)
        return null;
    // Superseded by a later rig-scoped restore event containing this node.
    // restore.completed/restore.subset_completed are rig-scoped (no top-level nodeId),
    // so query by rig_id and parse payloads for node containment.
    const laterRestoreRows = db.prepare("SELECT payload FROM events WHERE rig_id = ? AND type IN ('restore.completed', 'restore.subset_completed') AND seq > ? ORDER BY seq DESC").all(rigId, heldRow.seq);
    for (const row of laterRestoreRows) {
        try {
            const event = JSON.parse(row.payload);
            if (event.result?.nodes?.some((n) => n.nodeId === nodeId))
                return null;
        }
        catch {
            continue;
        }
    }
    try {
        const parsed = JSON.parse(heldRow.payload);
        return parsed.reason ?? null;
    }
    catch {
        return null;
    }
}
function getLatestError(db, rigId, nodeId) {
    const row = db.prepare("SELECT payload FROM events WHERE rig_id = ? AND node_id = ? AND type = 'node.startup_failed' ORDER BY seq DESC LIMIT 1").get(rigId, nodeId);
    if (!row)
        return null;
    try {
        const event = JSON.parse(row.payload);
        return event.error ?? null;
    }
    catch {
        return null;
    }
}
/**
 * Map persisted projection entries to the installedResources shape.
 * The startup-orchestrator persists: { category, effectiveId, sourceSpec, sourcePath, resourcePath, absolutePath, mergeStrategy, target }
 * We normalize to: { id, category, targetPath }
 */
function mapProjectionEntries(entries) {
    return entries.map((e) => {
        const entry = e;
        return {
            id: entry.effectiveId ?? entry.id ?? "",
            category: entry.category ?? "",
            targetPath: entry.target ?? entry.targetPath ?? "",
        };
    });
}
/**
 * OPR.0.4.3.19 rev1-r2 B1 — gate a durable identity verdict to the CURRENT
 * binding. The verdict table is keyed only by node_id, so on rebind/relaunch
 * (same node_id, new session + new pane) the stored verdict describes a pane
 * that is no longer bound. Serving it for the new pane opens a false-green
 * window (a stale `verified` suppresses the down-rank a fresh squat/orphan
 * should trigger; a stale `mismatch` would down-rank a healthy new pane).
 *
 * Same-name/same-pane handovers also replace the occupant. The observation
 * must belong to the latest registration and follow the recorded handover.
 * observedAt is captured before the reconciler's async probes, so a sweep
 * that finishes after cutover still carries its predecessor observation time.
 * Otherwise return null — the projection treats it as ABSENT (fail-open: a
 * running seat is left unchanged, never down-ranked). This keeps the rev1-r1
 * fail-open discipline: turning a stale verdict into ABSENT never down-ranks;
 * only a matching mismatch/pane_missing does.
 */
function applicableVerdict(verdict, row) {
    if (!verdict)
        return null;
    if (verdict.sessionName !== row.session_name)
        return null;
    if (verdict.evidence.registeredPane !== row.binding_tmux_pane)
        return null;
    const observedAt = Date.parse(verdict.observedAt);
    if (!Number.isFinite(observedAt))
        return null;
    // SQLite's datetime('now') is UTC but omits the timezone suffix.
    const utcTime = (value) => Date.parse(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)
        ? `${value.replace(" ", "T")}Z` : value);
    if (row.session_created_at && !(observedAt >= utcTime(row.session_created_at)))
        return null;
    // Registry session IDs are ULIDs; retain their millisecond precision when
    // two registrations share SQLite's one-second created_at timestamp.
    if (row.session_id && /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i.test(row.session_id)
        && observedAt <= decodeTime(row.session_id))
        return null;
    // Equal-millisecond observations cannot establish which occupant was read.
    if (row.handover_at && !(observedAt > utcTime(row.handover_at)))
        return null;
    return verdict;
}
// -- Public API --
/**
 * Get the canonical node inventory for a rig.
 * Single source of truth consumed by CLI, UI, and MCP.
 */
export function getNodeInventory(db, rigId) {
    // Resolve the rig's latest usable snapshot once for the whole projection so per-node
    // recoverability checks share the same source of truth without N extra queries.
    const usableSnapshot = findLatestUsableSnapshot(db, rigId);
    // PL-007: rig's typed workspace block (if declared) loaded once per
    // projection so per-node kind resolution shares one parse.
    const workspaceSpec = readRigWorkspaceJson(db, rigId);
    // OPR.0.4.3.19: the persisted per-node liveness identity verdicts, read once
    // per projection (cheap indexed read, defensive to a missing table). Gates
    // the running/active green derivations below.
    const identityVerdicts = new SeatIdentityStore(db).getForRig(rigId);
    // FS-1 W1.3 S1/S2 — the per-node restore-outcome + oriented reads built ONCE
    // for the rig (was a query per node inside the rows.map). rig-scoped restore
    // map = the prior WHERE rig_id=? filter; oriented map is node-scoped/global.
    const restoreOutcomes = buildRestoreOutcomeMap(db, rigId);
    const orienteds = buildOrientedMap(db);
    const codexDaemonOptOuts = new AppliedLaunchObservationStore(db).readCurrentDaemonOptOuts();
    const rows = queryInventoryRows(db, rigId);
    return rows.map((row) => buildInventoryEntry(db, row, { usableSnapshot, workspaceSpec, identityVerdicts, restoreOutcomes, orienteds, codexDaemonOptOuts }));
}
/**
 * FS-1 W1.2 — the shared inventory-row query. Extracted verbatim from the prior
 * inline `getNodeInventory` SELECT so the single-rig and all-rigs paths run the
 * IDENTICAL query.
 *   - `rigId` given → one rig (`WHERE n.rig_id = ?`, `ORDER BY n.created_at`) —
 *     byte-identical to the prior per-rig read.
 *   - `rigId` omitted → ALL rigs in one pass (no WHERE; `ORDER BY n.rig_id,
 *     n.created_at` so JS grouping preserves each rig's `created_at` order,
 *     matching the per-rig ordering exactly).
 * The latest-session subquery (`s2.node_id = n.id ORDER BY id DESC LIMIT 1`)
 * rides the W1.1 index (051, idx_sessions_node_created_id).
 */
function runInventoryRowQuery(db, whereClause, orderClause, params) {
    // Join nodes with newest session (max ULID = max session.id string comparison)
    // and the rig name
    const hasCodexConfigProfile = db.prepare("PRAGMA table_info(nodes)").all()
        .some((row) => row.name === "codex_config_profile");
    const codexConfigProfileSelect = hasCodexConfigProfile
        ? "n.codex_config_profile"
        : "NULL";
    const stmt = db.prepare(`
    SELECT
      n.id as node_id,
      n.rig_id,
      r.name as rig_name,
      n.logical_id,
      n.pod_id,
      p.namespace as pod_namespace,
      n.role,
      n.runtime,
      n.model,
      ${codexConfigProfileSelect} as codex_config_profile,
      n.agent_ref,
      n.profile,
      n.cwd,
      n.restore_policy,
      n.resolved_spec_name,
      n.resolved_spec_version,
      n.resolved_spec_hash,
      n.occupant_lifecycle,
      n.continuity_outcome,
      n.handover_result,
      n.previous_occupant,
      n.handover_at,
      s.id as session_id,
      s.session_name,
      s.created_at as session_created_at,
      s.status as session_status,
      ${sessionAgentAppSelect(db)} as session_agent_app,
      s.intentionally_stopped,
      s.startup_status,
      s.resume_type,
      s.resume_token,
      s.startup_completed_at,
      b.attachment_type as binding_attachment_type,
      b.id as binding_id,
      b.tmux_pane as binding_tmux_pane
    FROM nodes n
    JOIN rigs r ON r.id = n.rig_id
    LEFT JOIN pods p ON p.id = n.pod_id
    LEFT JOIN sessions s ON s.node_id = n.id
      AND s.id = (SELECT s2.id FROM sessions s2 WHERE s2.node_id = n.id ORDER BY s2.id DESC LIMIT 1)
    LEFT JOIN bindings b ON b.node_id = n.id
    ${whereClause}
    ORDER BY ${orderClause}
  `);
    return stmt.all(...params);
}
// Single-rig (WHERE n.rig_id=?) or ALL-rigs (no WHERE). Byte-identical SQL/order to
// the prior inline read; existing single-rig callers are unchanged.
function queryInventoryRows(db, rigId) {
    return runInventoryRowQuery(db, rigId ? "WHERE n.rig_id = ?" : "", rigId ? "n.created_at" : "n.rig_id, n.created_at", rigId ? [rigId] : []);
}
// Scoped to a rig-id SET — every IN value bound as a parameter; per-rig created_at
// order preserved (same ORDER BY as the all-rigs path). Callers guarantee a
// non-empty list (empty set → getNodeInventoryForRigs returns early, no query run).
function queryInventoryRowsForRigs(db, rigIds) {
    const placeholders = rigIds.map(() => "?").join(", ");
    return runInventoryRowQuery(db, `WHERE n.rig_id IN (${placeholders})`, "n.rig_id, n.created_at", rigIds);
}
/**
 * Build the shared inventory projection from a registration and its rig context.
 * Apply only current-occupant identity evidence and retain stored status alongside
 * effective status so readers can distinguish absence from registration history.
 */
function buildInventoryEntry(db, row, ctx) {
    const { usableSnapshot, workspaceSpec, identityVerdicts, restoreOutcomes, orienteds, codexDaemonOptOuts } = ctx;
    // FS-1 W1.3 S1 — O(1) lookup into the once-per-rig restore-outcome map
    // (byte-identical to the prior per-node deriveRestoreOutcome; "n-a" when a node
    // is referenced by no restore event, matching the prior fall-through).
    const restore = restoreOutcomes.get(restoreKey(row.rig_id, row.node_id));
    const restoreOutcome = restore?.outcome ?? "n-a";
    // OPR.0.4.3.19 rev1-r2 B1 — a durable verdict is keyed only by node_id, so
    // after a rebind/relaunch (same node, NEW session + NEW pane) a stale
    // `verified` verdict for the OLD pane would otherwise be served for the new
    // pane until the next 5s reconcile tick, suppressing down-rank and rendering
    // a fresh squat/orphan false-green. Make applicability LOAD-BEARING at read
    // time: a stored verdict applies ONLY when it was computed against the
    // current binding (its sessionName === the latest session AND its
    // registeredPane === the current binding pane). Otherwise treat it as ABSENT
    // (null) — a STALE verdict becomes fail-open (never down-ranks a running
    // seat), it does NOT itself down-rank. Only a MATCHING mismatch/pane_missing
    // verdict down-ranks.
    const identityVerdict = applicableVerdict(identityVerdicts.get(row.node_id) ?? null, row);
    // Keep registry history intact; only an applicable, explicit absence changes
    // the current status. Unavailable tmux and process mismatches are not absence.
    const sessionStatus = row.session_status === "running" && identityVerdictConfirmsSessionMissing(identityVerdict)
        ? "detached" : row.session_status;
    const lifecycleState = deriveNodeLifecycleState({
        sessionStatus,
        startupStatus: row.startup_status,
        restoreOutcome,
        nodeId: row.node_id,
        usableSnapshot,
        identityVerdict: identityVerdict?.verdict ?? null,
    });
    return {
        nodeId: row.node_id,
        rigId: row.rig_id,
        rigName: row.rig_name,
        logicalId: row.logical_id,
        podId: row.pod_id,
        podNamespace: row.pod_namespace,
        // OPR.0.4.6.FAC1: the seat-side role dimension (nodes.role,
        // declared in the pod-member spec) — the workflow binding layer's
        // candidate filter. null = role-less (never role-resolved).
        role: row.role,
        canonicalSessionName: row.session_name,
        attachmentType: row.binding_attachment_type ?? null,
        nodeKind: deriveNodeKind(row.runtime),
        runtime: row.runtime,
        ...(agentAppOf(row.session_agent_app, row.runtime) ? { agentApp: agentAppLabel(row.runtime) } : {}),
        sessionStatus,
        storedSessionStatus: row.session_status,
        intentionallyStopped: row.intentionally_stopped === 1
            && row.session_status === "exited" && row.binding_id === null,
        // Match the graph's current-status projection without rewriting the startup
        // result. Applicable mismatch (including ambiguity) or pane_missing overrides it.
        storedStartupStatus: row.startup_status,
        startupStatus: sessionStatus === "running"
            && identityVerdictDownranksRunning(identityVerdict?.verdict)
            ? "attention_required"
            : row.startup_status,
        restoreOutcome,
        // FS-1 W1.3 S2 — O(1) lookup into the fleet-batched oriented map
        // (byte-identical to the prior per-node deriveOriented; "n-a" when a node has
        // no proof events, matching deriveOriented's no-challenge branch).
        oriented: orienteds.get(row.node_id) ?? "n-a",
        lifecycleState,
        occupantLifecycle: deriveOccupantLifecycle(row, identityVerdict),
        continuityOutcome: deriveContinuityOutcome(row, restore),
        handoverResult: row.handover_result ?? null,
        previousOccupant: row.previous_occupant,
        handoverAt: row.handover_at,
        tmuxAttachCommand: row.binding_attachment_type === "tmux" && row.session_name ? tmuxAttachCommand(row.session_name) : null,
        resumeCommand: computeResumeCommand(row.runtime, row.resume_token, row.codex_config_profile, codexDaemonOptOuts.get(row.node_id)),
        // OPR.0.4.0.26: recoveryGuidance is NOT inlined per node in the LIST
        // payload. It duplicated ~47KB of templated prose across all nodes and
        // no node-list consumer reads it. The full guidance is recomputed on
        // the single-node detail path (getNodeDetail / GET
        // /api/rigs/:rigId/nodes/:logicalId) — relocation, not loss.
        recoveryGuidance: null,
        latestError: row.startup_status === "ready" ? null : getLatestError(db, row.rig_id, row.node_id),
        // Extended fields
        model: row.model,
        agentRef: row.agent_ref,
        profile: row.profile,
        codexConfigProfile: row.codex_config_profile,
        resolvedSpecName: row.resolved_spec_name,
        resolvedSpecVersion: row.resolved_spec_version,
        resolvedSpecHash: row.resolved_spec_hash,
        cwd: row.cwd,
        restorePolicy: row.restore_policy,
        resumeType: row.resume_type,
        resumeToken: row.resume_token,
        startupCompletedAt: row.startup_completed_at,
        // PL-007 Workspace Primitive — per-node workspace summary derived
        // from cwd against the rig's typed workspace block. null when the
        // rig has no workspace declaration.
        workspace: resolveNodeWorkspace({ spec: workspaceSpec, cwd: row.cwd }),
        // OPR.0.4.3.19 — the liveness identity verdict (third axis). null when
        // never observed; carries evidence on mismatch/missing.
        identityVerdict,
        heldReason: deriveHeldReason(db, row.rig_id, row.node_id, sessionStatus),
    };
}
/** FS-1 W1.2 — all-rigs batched form of `readRigWorkspaceJson`: one query,
 *  `rigId → WorkspaceSpec`. Rigs with no/malformed workspace are absent (callers
 *  default to null — byte-identical to `readRigWorkspaceJson`'s null return). */
function readAllRigWorkspaceJson(db) {
    const out = new Map();
    try {
        const rows = db.prepare("SELECT id, workspace_json FROM rigs").all();
        for (const row of rows) {
            if (!row.workspace_json)
                continue;
            try {
                out.set(row.id, JSON.parse(row.workspace_json));
            }
            catch { /* malformed → absent → caller null (matches per-rig) */ }
        }
    }
    catch { /* column/table absent → empty → caller null (matches per-rig defensive path) */ }
    return out;
}
/**
 * FS-1 W1.2 — the rig-level N+1 collapse. Builds inventory for ALL rigs in a
 * bounded, rig-count-INDEPENDENT set of queries: 3 batched setup reads
 * (snapshots / workspaces / identity verdicts) + 1 all-rigs node SELECT, grouped
 * by rig_id. Every entry is built through the SAME `buildInventoryEntry` that the
 * per-rig `getNodeInventory` uses, so `getNodeInventoryForAllRigs(db).get(rigId)`
 * is byte-identical to `getNodeInventory(db, rigId)` — the collapse changes only
 * HOW the context + rows are fetched (batched vs per-rig), never how an entry is
 * derived. Per-node reads inside `buildInventoryEntry` (`deriveRestoreOutcome`
 * etc.) remain per-node and ride the 047 index — NOT the rig-level N+1 removed here.
 */
// Shared batched builder — the common body of the all-rigs and scoped-rigs paths.
// Builds the fleet setup maps + EXACTLY one fleet startup-orientation
// (buildOrientedMap) and one fleet restore-outcome (buildRestoreOutcomeMap) scan
// ONCE, then builds a NodeInventoryEntry for each PROVIDED row via the SAME
// buildInventoryEntry, grouped by rig_id with per-rig created_at order preserved.
// `rows` decides the scope (all rigs vs a selected rig set); entry derivation is
// identical, so a rig's entries are byte-identical regardless of which caller ran.
function buildInventoryMapFromRows(db, rows) {
    const snapshotByRig = findLatestUsableSnapshotsForAllRigs(db);
    const workspaceByRig = readAllRigWorkspaceJson(db);
    const verdictsByRig = new SeatIdentityStore(db).getForAllRigs();
    // FS-1 W1.3 S1/S2 — the per-node reads built ONCE (O(1) queries, not O(nodes)).
    // Restore map unscoped: a nodeId is referenced only by its own rig's restore
    // events, so each node's value equals the single-rig path.
    const restoreOutcomes = buildRestoreOutcomeMap(db); // one fleet restore-outcome scan
    const orienteds = buildOrientedMap(db); // one fleet startup-orientation scan
    const codexDaemonOptOuts = new AppliedLaunchObservationStore(db).readCurrentDaemonOptOuts(); // one launch-fact read
    const out = new Map();
    for (const row of rows) {
        const entry = buildInventoryEntry(db, row, {
            usableSnapshot: snapshotByRig.get(row.rig_id) ?? null,
            workspaceSpec: workspaceByRig.get(row.rig_id) ?? null,
            identityVerdicts: verdictsByRig.get(row.rig_id) ?? new Map(),
            restoreOutcomes,
            orienteds,
            codexDaemonOptOuts,
        });
        let list = out.get(row.rig_id);
        if (!list) {
            list = [];
            out.set(row.rig_id, list);
        }
        list.push(entry);
    }
    return out;
}
export function getNodeInventoryForAllRigs(db) {
    return buildInventoryMapFromRows(db, queryInventoryRows(db));
}
// slice-04 — inventory for a SELECTED set of rigs only (e.g. the rigs a summary
// actually returns), so the per-node fold never widens to rigs the caller excluded
// (e.g. archived). Retains exactly one fleet startup-orientation + one fleet
// restore-outcome scan via the shared builder. Empty set → empty Map, NO scans and
// no invalid `IN ()`. getNodeInventoryForRigs(db, {r}).get(r) is byte-identical to
// the all-rigs path's entry list for r (same rows, same builder).
export function getNodeInventoryForRigs(db, rigIds) {
    if (rigIds.size === 0)
        return new Map();
    return buildInventoryMapFromRows(db, queryInventoryRowsForRigs(db, [...rigIds]));
}
/** PL-007 — read the rig's typed workspace block from `rigs.workspace_json`
 *  defensively. Migration 038 may not yet be applied in older test fixtures
 *  that bypass the canonical migration list, so a missing column returns
 *  null cleanly. */
function readRigWorkspaceJson(db, rigId) {
    try {
        const row = db.prepare("SELECT workspace_json FROM rigs WHERE id = ?")
            .get(rigId);
        if (!row || !row.workspace_json)
            return null;
        return JSON.parse(row.workspace_json);
    }
    catch {
        return null;
    }
}
/**
 * Get detailed node information including startup files, resources, and events.
 * The adapter dependency is optional — when provided, uses live listInstalled;
 * otherwise falls back to projection entries from startup context.
 */
export function getNodeDetail(db, rigId, logicalId, opts) {
    // Get the inventory entry first
    const allEntries = getNodeInventory(db, rigId);
    const entry = allEntries.find((e) => e.logicalId === logicalId);
    if (!entry)
        return null;
    // Find the node ID
    const nodeRow = db.prepare("SELECT id FROM nodes WHERE rig_id = ? AND logical_id = ?").get(rigId, logicalId);
    if (!nodeRow)
        return null;
    const nodeId = nodeRow.id;
    // Binding
    const bindingRow = db.prepare("SELECT * FROM bindings WHERE node_id = ?").get(nodeId);
    const binding = bindingRow ? {
        id: bindingRow.id,
        nodeId,
        attachmentType: bindingRow.attachment_type ?? "tmux",
        tmuxSession: bindingRow.tmux_session,
        tmuxWindow: bindingRow.tmux_window,
        tmuxPane: bindingRow.tmux_pane,
        externalSessionName: bindingRow.external_session_name ?? null,
        cmuxWorkspace: bindingRow.cmux_workspace,
        cmuxSurface: bindingRow.cmux_surface,
        updatedAt: bindingRow.updated_at,
    } : null;
    // Startup context
    const ctxRow = db.prepare("SELECT * FROM node_startup_context WHERE node_id = ?").get(nodeId);
    const startupFiles = ctxRow ? JSON.parse(ctxRow.resolved_files_json) : [];
    const startupActions = ctxRow ? JSON.parse(ctxRow.startup_actions_json) : [];
    const projectionEntries = ctxRow ? JSON.parse(ctxRow.projection_entries_json) : [];
    // Installed resources: override (from async adapter call) > projection fallback
    let installedResources;
    if (opts?.installedResourcesOverride) {
        installedResources = opts.installedResourcesOverride;
    }
    else if (opts?.adapters?.[entry.runtime ?? ""] && binding) {
        // Adapter is available — caller should have pre-resolved via listInstalled (async).
        // If caller passed adapters but not override, try sync call for test compatibility.
        try {
            const adapter = opts.adapters[entry.runtime ?? ""];
            const nodeBinding = { ...binding, cwd: entry.cwd ?? "." };
            const resources = adapter.listInstalled(nodeBinding);
            // Handle both sync (test mocks) and Promise (real adapters)
            if (Array.isArray(resources)) {
                installedResources = resources.map((r) => ({
                    id: r.effectiveId,
                    category: r.category,
                    targetPath: r.installedPath,
                }));
            }
            else {
                // Async — fall through to projection
                installedResources = mapProjectionEntries(projectionEntries);
            }
        }
        catch {
            installedResources = mapProjectionEntries(projectionEntries);
        }
    }
    else {
        // Projection fallback
        installedResources = mapProjectionEntries(projectionEntries);
    }
    // Recent events (last 20 for this node)
    const eventRows = db.prepare("SELECT * FROM events WHERE node_id = ? ORDER BY seq DESC LIMIT 20").all(nodeId);
    const recentEvents = eventRows.map((r) => {
        let payload = {};
        try {
            payload = JSON.parse(r.payload);
        }
        catch { /* empty */ }
        return {
            type: r.type,
            createdAt: r.created_at,
            payload,
        };
    });
    // Infrastructure startup command
    let infrastructureStartupCommand = null;
    if (entry.nodeKind === "infrastructure" && startupActions.length > 0) {
        const sendTextAction = startupActions.find((a) => a.type === "send_text");
        if (sendTextAction) {
            infrastructureStartupCommand = sendTextAction.value;
        }
    }
    // Peers: other nodes in the same rig
    const peers = allEntries
        .filter((e) => e.logicalId !== logicalId)
        .map((e) => ({
        logicalId: e.logicalId,
        canonicalSessionName: e.canonicalSessionName,
        attachmentType: e.attachmentType,
        runtime: e.runtime,
    }));
    // Edges: outgoing and incoming for this node
    const edgeRows = db.prepare("SELECT e.kind, e.source_id, e.target_id, src.logical_id as src_logical, tgt.logical_id as tgt_logical " +
        "FROM edges e " +
        "JOIN nodes src ON src.id = e.source_id " +
        "JOIN nodes tgt ON tgt.id = e.target_id " +
        "WHERE e.rig_id = ? AND (e.source_id = ? OR e.target_id = ?)").all(rigId, nodeId, nodeId);
    const nodeSessionMap = new Map(allEntries.map((e) => [e.logicalId, e.canonicalSessionName]));
    const outgoing = [];
    const incoming = [];
    for (const row of edgeRows) {
        if (row.source_id === nodeId) {
            outgoing.push({ kind: row.kind, to: { logicalId: row.tgt_logical, sessionName: nodeSessionMap.get(row.tgt_logical) ?? null } });
        }
        if (row.target_id === nodeId) {
            incoming.push({ kind: row.kind, from: { logicalId: row.src_logical, sessionName: nodeSessionMap.get(row.src_logical) ?? null } });
        }
    }
    // Compact spec summary
    const compactSpec = {
        name: entry.resolvedSpecName,
        version: entry.resolvedSpecVersion,
        profile: entry.profile,
        skillCount: installedResources.filter((r) => r.category === "skill" || r.category === "skills").length,
        guidanceCount: installedResources.filter((r) => r.category === "guidance" || r.category === "guidance_merge").length,
    };
    return {
        ...entry,
        // OPR.0.4.0.26: the LIST omits recoveryGuidance to stay slim; the
        // single-node detail recomputes the full guidance from the entry's
        // resume fields (relocation of the per-node prose, not loss).
        recoveryGuidance: computeRecoveryGuidance({
            runtime: entry.runtime,
            resumeToken: entry.resumeToken,
            cwd: entry.cwd,
            sessionName: entry.canonicalSessionName,
            codexConfigProfile: entry.codexConfigProfile,
            codexDaemonOptOut: entry.runtime === "codex" ? new AppliedLaunchObservationStore(db).readCurrent(nodeId)?.daemonOptOut : undefined,
        }),
        binding,
        startupFiles,
        startupActions,
        installedResources,
        recentEvents,
        infrastructureStartupCommand,
        peers,
        edges: { outgoing, incoming },
        transcript: { enabled: false, path: null, tailCommand: null }, // populated by route handler
        compactSpec,
    };
}
/**
 * Context-aware wrapper: returns inventory with context usage attached.
 * Uses one daemon-owned ContextUsageStore for all reads.
 */
export function getNodeInventoryWithContext(db, rigId, contextUsageStore, transcriptStore) {
    const entries = getNodeInventory(db, rigId);
    // Find node IDs for batch read
    const nodeRows = db.prepare("SELECT id, logical_id FROM nodes WHERE rig_id = ?").all(rigId);
    const nodeIdByLogicalId = new Map(nodeRows.map((r) => [r.logical_id, r.id]));
    const contextEntries = entries.map((e) => ({
        nodeId: nodeIdByLogicalId.get(e.logicalId) ?? "",
        currentSessionName: e.canonicalSessionName,
    }));
    const contextMap = contextUsageStore.getForNodes(contextEntries);
    return entries.map((e) => {
        const nodeId = nodeIdByLogicalId.get(e.logicalId) ?? "";
        const usage = contextMap.get(nodeId) ?? contextUsageStore.unknownUsage("no_data");
        // OPR.0.4.0.26: drop the heavy `currentUsage` blob from the LIST
        // contextUsage (a serialized per-node usage payload, ~79KB across a
        // large fleet; no node-list consumer reads it). All scalars are kept so
        // the ring/table/filter consumers are unaffected. The full currentUsage
        // remains on the detail/whoami path (getNodeDetailWithContext, whoami).
        const transcriptIngest = transcriptStore && e.canonicalSessionName
            ? {
                ...transcriptStore.getIngestHealth(e.rigName, e.canonicalSessionName),
                runtime: e.runtime,
            }
            : undefined;
        return {
            ...e,
            contextUsage: { ...usage, currentUsage: null },
            ...(transcriptIngest ? { transcriptIngest } : {}),
        };
    });
}
/**
 * Context-aware wrapper: returns node detail with context usage attached.
 */
export function getNodeDetailWithContext(db, rigId, logicalId, contextUsageStore, opts) {
    const detail = getNodeDetail(db, rigId, logicalId, opts);
    if (!detail)
        return null;
    const nodeRow = db.prepare("SELECT id FROM nodes WHERE rig_id = ? AND logical_id = ?").get(rigId, logicalId);
    if (nodeRow) {
        detail.contextUsage = contextUsageStore.getForNode(nodeRow.id, detail.canonicalSessionName);
    }
    else {
        detail.contextUsage = contextUsageStore.unknownUsage("no_data");
    }
    return detail;
}
/**
 * Slice 15 — populate `terminalActive` + `hasAssignedWork` per node.
 *
 * Two orthogonal enrichments computed independently (non-inference
 * contract per IMPL-PRD §2.3):
 *   - `terminalActive`: read from SeatActivityService (tmux signal)
 *   - assigned-work counts: pending, in-progress, and blocked queue_items
 *     where destination_session matches either canonical coordinate for the seat
 *
 * Pure / synchronous — keeps the projection cheap for both `rig ps` and
 * the UI which both fetch this per-request. The two enrichments do not
 * read each other's source.
 */
export function attachTerminalActivityAndWork(entries, deps) {
    const seatActivity = deps.seatActivity ?? null;
    const assignedByDest = readAssignedWorkBySession(deps.db);
    return entries.map((entry) => {
        const sessionMissing = identityVerdictConfirmsSessionMissing(entry.identityVerdict);
        let terminalActive = sessionMissing ? false : undefined;
        // ARCH RULING 3a947fb1 (FR-7 additive): project the RAW lastActivityAt fact
        // alongside terminalActive from the SAME observation — honest-absence ladder
        // (obs → value, no obs → null, no service → undefined). No ageSeconds
        // sibling; age is derived renderer-side from this fact + a reader clock (C3).
        let lastActivityAt = sessionMissing ? null : undefined;
        if (!sessionMissing && seatActivity && entry.canonicalSessionName) {
            const obs = seatActivity.getSeatActivity(entry.canonicalSessionName);
            terminalActive = obs ? obs.isActiveWithinWindow : null;
            lastActivityAt = obs ? obs.lastActivityAt : null;
        }
        // S19 — the arbitrated taxonomy state from the ONE oracle, display pre-derived
        // through the single bridge (consumers render, never re-arbitrate).
        let activityState = sessionMissing ? null : undefined;
        // Capability-checked: a partial injected double without the S19 surface keeps the
        // pre-taxonomy shape (undefined) rather than faking a null oracle answer.
        if (!sessionMissing && seatActivity && entry.canonicalSessionName && typeof seatActivity.getSeatStateBySession === "function") {
            const arb = seatActivity.getSeatStateBySession(entry.canonicalSessionName);
            activityState = arb
                ? {
                    activity: arb.activity,
                    display: deriveDisplayActivity(arb.activity, arb.needsInput),
                    needsInput: arb.needsInput,
                    decidedBy: arb.decidedBy,
                    seq: arb.seq,
                    lastSwap: arb.lastSwap,
                }
                : null;
        }
        const work = countAssignedWorkForEntry(entry, assignedByDest);
        return {
            ...entry,
            terminalActive,
            lastActivityAt,
            activityState,
            hasAssignedWork: work.assignedWorkCount > 0,
            ...work,
        };
    });
}
export function countAssignedWorkForEntry(entry, assignedByDest) {
    const keys = new Set();
    if (entry.canonicalSessionName)
        keys.add(entry.canonicalSessionName);
    const derived = deriveCanonicalFromEntry(entry);
    if (derived)
        keys.add(derived);
    const total = {
        assignedWorkCount: 0,
        pendingWorkCount: 0,
        inProgressWorkCount: 0,
        blockedWorkCount: 0,
    };
    for (const key of keys) {
        const counts = assignedByDest.get(key);
        if (!counts)
            continue;
        total.assignedWorkCount += counts.assignedWorkCount;
        total.pendingWorkCount += counts.pendingWorkCount;
        total.inProgressWorkCount += counts.inProgressWorkCount;
        total.blockedWorkCount += counts.blockedWorkCount;
    }
    return total;
}
/** EXPORTED (OPR.0.4.6.FAC1): the derived canonical coordinate
 *  `{pod}-{member}@{rig}` for an inventory entry — the binding layer's
 *  ONE string rule (tiebreak key AND recorded destination) reuses
 *  exactly this dual-key derivation, never a parallel one. */
export function deriveCanonicalFromEntry(entry) {
    if (!entry.rigName || !entry.logicalId)
        return null;
    const dotIdx = entry.logicalId.indexOf(".");
    if (dotIdx <= 0 || dotIdx === entry.logicalId.length - 1)
        return null;
    const pod = entry.logicalId.slice(0, dotIdx);
    const member = entry.logicalId.slice(dotIdx + 1);
    return deriveCanonicalSessionName(pod, member, entry.rigName);
}
export function readAssignedWorkBySession(db) {
    const rows = db.prepare(`
    SELECT destination_session,
      COUNT(*) as assigned_count,
      SUM(CASE WHEN state = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN state = 'in-progress' THEN 1 ELSE 0 END) as in_progress_count,
      SUM(CASE WHEN state = 'blocked' THEN 1 ELSE 0 END) as blocked_count
    FROM queue_items
    WHERE state IN ('pending', 'in-progress', 'blocked')
    GROUP BY destination_session
  `).all();
    const out = new Map();
    for (const r of rows) {
        out.set(r.destination_session, {
            assignedWorkCount: r.assigned_count,
            pendingWorkCount: r.pending_count,
            inProgressWorkCount: r.in_progress_count,
            blockedWorkCount: r.blocked_count,
        });
    }
    return out;
}
export async function attachAgentActivity(entries, deps) {
    const sampledAt = deps.now ?? new Date();
    const captureFallback = deps.captureFallback ?? false;
    return Promise.all(entries.map(async (entry) => {
        // A cached hook, pane sample or motion cannot revive a confirmed absent
        // session. Preserve the identity observation's provenance without probing.
        if (identityVerdictConfirmsSessionMissing(entry.identityVerdict)) {
            return {
                ...entry,
                agentActivity: {
                    state: "unknown",
                    reason: "session_missing",
                    evidenceSource: "tmux_session",
                    sampledAt: entry.identityVerdict.observedAt,
                    evidence: entry.canonicalSessionName,
                },
            };
        }
        // ACTIVITY D1+D2 — the MOTION reading, resolved once for the activity ladder below.
        const motion = entry.canonicalSessionName
            ? deps.seatActivity?.getSeatActivity(entry.canonicalSessionName) ?? null
            : null;
        /**
         * Freshness is decided HERE, at read time, from the RAW `lastActivityAt` against the request
         * clock — NEVER from the cached `isActiveWithinWindow` boolean alone.
         *
         * WHY (dev50-guard HOLD on 29ad1b2b9): `SeatActivityService.pollSeat` returns null on a tmux
         * error BEFORE it replaces or deletes the cached record, and `pollAllRunningTmuxSeats` only
         * evicts seats that are no longer running in the DB. A seat still marked running whose tmux read
         * keeps failing therefore KEEPS its last observation forever — including a `true`. Trusting that
         * boolean turned an UNAVAILABLE observation into an affirmative liveness claim: ACTIVITY would
         * report `running` indefinitely after the instrument went dark.
         *
         * That is this ladder's own no-fabrication rule broken in the unwatched direction. Three guards
         * below stop motion inventing `idle` from silence; none of them stopped a dead cache inventing
         * `running`. A silent seat and a seat we can no longer SEE are different states, and only the
         * raw timestamp distinguishes them.
         *
         * Fail CLOSED when the fact cannot be aged (absent or unparseable): an un-ageable affirmative is
         * indistinguishable from a long-dead one, so it must not become a liveness claim.
         *
         * The seat's OWN `silenceWindowSeconds` is the threshold — the same one the service used at poll
         * time. No second threshold is invented here. A negative age (raw fact slightly ahead of the
         * request clock) still reads live, preserving pollSeat's deliberate clock-skew tolerance.
         */
        const motionRunning = (() => {
            if (motion?.isActiveWithinWindow !== true)
                return false;
            const rawMs = motion.lastActivityAt ? Date.parse(motion.lastActivityAt) : Number.NaN;
            if (!Number.isFinite(rawMs))
                return false;
            const ageSeconds = (sampledAt.getTime() - rawMs) / 1000;
            return ageSeconds < motion.silenceWindowSeconds;
        })();
        /**
         * ACTIVITY D1+D2 — precedence below, except for a current typed usage limit:
         *
         *     needs_input > running > MOTION > idle / unknown
         *
         * Live motion UPGRADES a verdict of `idle` or `unknown`; it never touches `needs_input` or an
         * already-`running` verdict, and it never MANUFACTURES `idle`. That asymmetry is the whole
         * safety argument, and it is what each half of the defect needs:
         *
         *   D1 (Codex → unknown) is COVERAGE. A Codex seat has no hook, and the structural matcher is
         *     Claude-shaped over a fixed 8-line tail window, so a tall Codex footer pushes the real work
         *     line out of view and the seat falls to `unknown`. Motion is a fact about bytes on the pane,
         *     so it covers every runtime without a matcher per provider — the treadmill this avoids.
         *   D2 (Claude → idle) is PRECEDENCE. A seat that Stopped and then RESUMED still carries the
         *     stale positive `idle` hook as its latest, and the old early-return handed that back as
         *     authoritative before anything else was consulted. A perfect motion source placed further
         *     down the ladder would still have lost to it. Motion has to outrank a POSITIVE idle hook,
         *     not merely an absent one.
         *
         * Why `needs_input` outranks motion: motion cannot tell "working" from "waiting at a prompt" —
         * any per-second redraw keeps the window fresh. If motion outranked a needs_input TEXT verdict,
         * a seat asking for permission would be relabelled `running`, and the parking watch would step
         * over the one seat that is actually blocked.
         *
         * Why motion never yields `idle`: a silent window is not evidence of a quiet agent (a seat can
         * think for a long time without printing). Deriving `idle` from silence would satisfy
         * "not unknown" by relabelling the default, which is the closed union rotting rather than the
         * signal improving. Silence therefore leaves the prior verdict exactly as it was.
         */
        const withMotion = (activity) => {
            if (!motionRunning)
                return activity;
            if (activity.state !== "idle" && activity.state !== "unknown")
                return activity;
            return {
                state: "running",
                reason: "window_activity_motion",
                evidenceSource: "terminal_activity",
                sampledAt: motion.lastObservedAt,
                // The RAW `#{window_activity}` timestamp that earned the verdict — a reader can age it
                // against their own clock and see for themselves why this seat reads running.
                evidence: motion.lastActivityAt ?? null,
                runtime: entry.runtime ?? null,
            };
        };
        const hookActivity = deps.activityStore?.getLatestForNode({
            sessionName: entry.canonicalSessionName,
            now: sampledAt,
        });
        // A fresh POSITIVE hook (running/needs_input/idle) is authoritative — EXCEPT that a positive
        // `idle` hook now yields to live motion (D2). running/needs_input hooks are untouched.
        if (hookActivity && hookActivity.state !== "unknown") {
            return {
                ...entry,
                agentActivity: withMotion(hookActivity),
            };
        }
        // Capture-free cache read; the service rejects expired observations.
        const structural = entry.canonicalSessionName
            ? deps.structuralActivity?.getStructuralActivity(entry.canonicalSessionName)
            : null;
        // #763: a typed provider-interruption row (at_limit) is positive evidence
        // even though its state is unknown by construction (it must never count
        // as waiting-on-a-person). Deliver it instead of the cached pane reading
        // so a limited seat shows the limit, not idle — but only while current.
        // Terminal redraws are not recovery evidence and must not erase the limit.
        // Only a strictly newer, current attention observation outranks it.
        // A demoted row (aged out or generation-mismatched) falls through to the
        // structural reading like any other stale hook.
        if (hookActivity?.rawEvent === "at_limit" && hookActivity.stale !== true && !(structural?.state === "attention" &&
            Date.parse(structural.observedAt) > Date.parse(hookActivity.eventAt ?? ""))) {
            return {
                ...entry,
                agentActivity: hookActivity,
            };
        }
        // Hook ABSENT or unknown/stale → consult the CACHED structural observation. This read is
        // capture-FREE: the pane capture already happened on the background SeatStructuralActivityService
        // tick, never here (the healthz-wedge no-per-request-capture invariant is preserved). A structural
        // motion verdict is a LIVENESS signal that OVERRIDES an absent/stale hook (constraint 2 — liveness
        // beats hook-arrival age) and makes ACTIVITY real on the DEFAULT path for hook-less / Codex /
        // just-finished-a-turn seats: the exact fleet-blindness this fix targets. Structural discrimination
        // is STRUCTURAL (spinner shapes / esc-to-interrupt / idle prompt), never a verb allowlist.
        if (structural && structural.state !== "unknown") {
            return {
                ...entry,
                agentActivity: withMotion({
                    state: mapPaneState(structural.state),
                    reason: structural.reason,
                    evidenceSource: "pane_heuristic",
                    sampledAt: structural.observedAt,
                    evidence: structural.evidence,
                }),
            };
        }
        // No positive hook and no structural verdict. A stale/unknown hook, if one exists, is delivered
        // HONESTLY as-is (unknown/stale) — never upgraded to a quiet-seat verdict on arrival age alone.
        // Live motion DOES upgrade it. A demoted hook is not exotic: a seat whose agent process lacks the
        // relay's launch environment (for example, relaunched outside the product launcher without
        // OPENRIG_RUNTIME or an occupant generation) posts no new hooks, so its newest stored hook can be
        // an old one from a prior tenure, read as generation_mismatch. Product-launched seats carry the
        // generation and post resolvable hooks. Where a hook is demoted, it — not a positive idle one —
        // is what stands between a working seat and a truthful label.
        if (hookActivity) {
            return {
                ...entry,
                agentActivity: withMotion(hookActivity),
            };
        }
        if (!captureFallback) {
            // CHEAP DEFAULT — no per-node tmux capture. A hook-less seat's pane-heuristic needs_input
            // still requires ?full/?refresh; running now comes from the capture-FREE motion read above,
            // so the honest `unknown` placeholder is reached only by a seat that is genuinely silent.
            return {
                ...entry,
                agentActivity: withMotion({
                    state: "unknown",
                    reason: "no_runtime_hook",
                    evidenceSource: "session_registry",
                    sampledAt: sampledAt.toISOString(),
                    evidence: null,
                    fallback: true,
                }),
            };
        }
        return {
            ...entry,
            agentActivity: withMotion(await probeSessionActivity({
                sessionName: entry.canonicalSessionName,
                runtime: entry.runtime,
                attachmentType: entry.attachmentType,
                tmuxAdapter: deps.tmuxAdapter,
                now: sampledAt,
                captureObserver: deps.captureObserver,
                binding: deps.captureObserver ? deps.observationBinding?.(entry) : undefined,
                agentApp: entry.agentApp?.app ?? null,
            })),
        };
    }));
}
//# sourceMappingURL=node-inventory.js.map