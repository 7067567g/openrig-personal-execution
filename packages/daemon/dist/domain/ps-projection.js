import { identityVerdictConfirmsSessionMissing } from "./types.js";
import { countAssignedWorkForEntry, getNodeInventoryForAllRigs, readAssignedWorkBySession, } from "./node-inventory.js";
import { archiveWhereClause } from "./rig-repository.js";
/** The rungs that can answer the needs-input signal (the ones `arbitrate` consults,
 *  chrome > hooks > self-report). Sampling carries no needs-input evidence. */
const NEEDS_INPUT_RUNGS = ["needs-input-chrome", "lifecycle-hooks", "self-report"];
/**
 * OPR.0.4.4.21 — THE rig-rollup attention predicate (one predicate, one
 * count; mirrors + extends the CLI's per-node `needsAttention`). A seat
 * needs attention iff ANY of:
 *   - lifecycle `attention_required`
 *   - startup `attention_required`/`failed` — counted DIRECTLY from
 *     startupStatus; `latestError` may legitimately be null here
 *   - `needs_input`: the ARBITRATED seat state is the first answer when it has one
 *     (`arbitratedNeedsInput` — the same oracle the per-seat row renders, pane chrome
 *     included), and the hook store's live `needs_input` is the fallback when the
 *     arbitrated signal is `null` (stale hooks arrive as `unknown` and contribute
 *     nothing — never guessed). The rig total and the seat row must not disagree
 *     about the same seat.
 *   - a held seat (`heldReason` present)
 *   - a recorded startup error (`latestError` present)
 */
export function seatNeedsAttention(entry, activity, arbitratedNeedsInput = null) {
    return entry.lifecycleState === "attention_required"
        || entry.startupStatus === "attention_required"
        || entry.startupStatus === "failed"
        || (arbitratedNeedsInput ?? activity?.state === "needs_input")
        || entry.heldReason != null
        || entry.latestError != null;
}
/**
 * #180 review — the arbitrated needs-input answer is TRI-STATE; collapsing it to
 * `needsInput.count > 0` treats `count: 0` as a definite "no" even when no source said
 * "no". `count: 0` is also the default when no authoritative rung reported needs-input:
 * a Codex seat (hooks at `trial`), a generic/Pi/OMP seat (sampling floor only), a seat
 * with no declaration, or a Claude seat whose declared rungs have not reported (after a
 * daemon restart, or once its hook rung is downgraded). A live `PermissionRequest` in
 * the hook store must still count there. Rules:
 *   - count > 0                                    → true  (the service only reports a
 *     positive count from an authoritative source)
 *   - count is 0 AND needs-input evidence from an authoritative rung supplied it → false
 *     (an observed clear legitimately supersedes a stale hook)
 *   - otherwise                                    → null (let the hook store decide).
 *     A declared rung is a capability, not an observation that the seat is clear.
 */
export function arbitratedNeedsInputSignal(state) {
    if (!state)
        return null;
    if (state.needsInput.count > 0)
        return true;
    const observedClear = state.needsInputEvidence != null
        && NEEDS_INPUT_RUNGS.includes(state.needsInputEvidence.rung);
    return observedClear ? false : null;
}
/**
 * Folds per-node lifecycle states into a rig-level lifecycle state.
 *
 *   attention_required > running > recoverable > stopped, with `degraded` for mixes.
 *
 * Rules (post-L2):
 *   - any node attention_required          → attention_required (priority over below).
 *   - all nodes running                    → running.
 *   - all nodes non-running, any recoverable → recoverable.
 *   - all nodes non-running, none recoverable → stopped.
 *   - mixed running + non-running          → degraded.
 *   - empty rig (no nodes)                 → stopped.
 *
 * `recoverable` at rig level depends on per-node recoverability, which already accounts
 * for whether the rig's latest usable snapshot has a resume token for that node.
 */
export function deriveRigLifecycleState(nodeStates) {
    if (nodeStates.length === 0)
        return "stopped";
    if (nodeStates.some((s) => s === "attention_required"))
        return "attention_required";
    const runningCount = nodeStates.filter((s) => s === "running").length;
    const totalCount = nodeStates.length;
    if (runningCount === totalCount)
        return "running";
    if (runningCount === 0) {
        const anyRecoverable = nodeStates.some((s) => s === "recoverable");
        return anyRecoverable ? "recoverable" : "stopped";
    }
    return "degraded";
}
/** Shared display rollup for ps and the rig summaries consumed by the TUI.
 * Intentionally stopped seats remain in process counts and node diagnostics. */
export function deriveRigLifecycleFromInventory(inventory) {
    return deriveRigLifecycleState(inventory.filter((entry) => !entry.intentionallyStopped).map((entry) => entry.lifecycleState));
}
/**
 * Slice-05 item-5 (D5) — the SINGLE effective-running predicate for the ps
 * running rollup. `sessions.status='running'` alone is verdict-blind: a seat
 * whose tmux session was torn down out-of-band keeps `status='running'` in the
 * DB, so the raw SQL count fabricates a dead seat as running. The
 * SeatIdentityReconciler (and, since Slice-05, the live SessionTransport on a
 * `session_missing` send/capture) records an APPLICABLE `session_missing`
 * verdict for exactly that case; node-inventory already surfaces it here,
 * applicability-gated (a stale verdict is null → fail-open).
 *
 * ONLY `reason === "session_missing"` — a genuinely-gone tmux session — is
 * excluded. `pane_pid_gone` / `mismatch` / `tmux_unavailable` and an absent or
 * inapplicable (null) verdict all stay running: an ambiguous or non-fatal
 * identity signal must never fabricate `stopped` (it down-ranks lifecycle to
 * attention, a separate axis). runningCount, status, and activeCount all flow
 * through this one predicate so the three never contradict each other. This
 * reads the verdict; it NEVER mutates `sessions.status`.
 */
export function isEffectivelyRunning(node) {
    if (node.sessionStatus !== "running")
        return false;
    if (identityVerdictConfirmsSessionMissing(node.identityVerdict))
        return false;
    return true;
}
/**
 * Projects rig/run summary for `rig ps`.
 * Aggregates across all rigs: node counts, running counts, status, uptime, snapshot age.
 */
export class PsProjectionService {
    db;
    seatActivity;
    /** OPR.0.4.4.21 — synchronous hook-activity lookup for the attention
     *  predicate's `needs_input` signal. Optional: absent → the signal
     *  contributes false (honest degrade), never a guess. */
    agentActivity;
    periodicSnapshotActive = false;
    periodicSnapshotIntervalSeconds = 0;
    constructor(deps) {
        this.db = deps.db;
        this.seatActivity = deps.seatActivity ?? null;
        this.agentActivity = deps.agentActivity ?? null;
    }
    setPeriodicSnapshotState(active, intervalSeconds) {
        this.periodicSnapshotActive = active;
        this.periodicSnapshotIntervalSeconds = intervalSeconds;
    }
    getEntries(filter) {
        // OPR.0.3.3.19 - default excludes archived rigs at the projection layer
        // (NOT client-side). Explicit includeArchived/archivedOnly opt in.
        const cond = archiveWhereClause("r.archived_at", filter);
        const where = cond ? `WHERE ${cond}` : "";
        const rows = this.db.prepare(`
      SELECT
        r.id as rig_id,
        r.name,
        r.archived_at as archived_at,
        (SELECT COUNT(*) FROM nodes n WHERE n.rig_id = r.id) as node_count,
        (SELECT snap.created_at FROM snapshots snap WHERE snap.rig_id = r.id ORDER BY snap.created_at DESC, snap.id DESC LIMIT 1) as latest_snapshot_at,
        (SELECT COUNT(*) FROM snapshots snap WHERE snap.rig_id = r.id AND snap.kind = 'auto-periodic') as auto_periodic_count
      FROM rigs r
      ${where}
      ORDER BY r.name
    `).all();
        const now = Date.now();
        // FS-1 W1.2 (rig-level N+1 collapse): the assigned-work map is host-global and
        // bounded by distinct destination sessions (seat count), so read it ONCE here
        // instead of one countNodesWithPendingWork query per rig. Per-rig hasWorkCount
        // is then a pure JS derivation over the already-fetched inventory below.
        const assignedByDest = readAssignedWorkBySession(this.db);
        // FS-1 W1.2: node inventory for ALL rigs built in ONE batched pass (was one
        // getNodeInventory query-set PER RIG — the rig-level N+1); indexed per rig below.
        const inventoryByRig = getNodeInventoryForAllRigs(this.db);
        // Read the current registration's timestamp once per node, in one batch.
        // Uptime membership comes from the same effective-running inventory below.
        const sessionTimes = this.db.prepare(`
      SELECT n.id as node_id,
        (SELECT s.created_at FROM sessions s WHERE s.node_id = n.id ORDER BY s.id DESC LIMIT 1) as created_at
      FROM nodes n JOIN rigs r ON r.id = n.rig_id
      ${where}
    `).all();
        const sessionCreatedAt = new Map(sessionTimes.map((row) => [row.node_id, row.created_at]));
        return rows.map((r) => {
            // Derive rig-level lifecycleState by folding per-node states. FS-1 W1.2:
            // inventory for ALL rigs was built in ONE batched pass above (previously one
            // getNodeInventory query-set per rig — the rig-level N+1); index it here.
            const inventory = inventoryByRig.get(r.rig_id) ?? [];
            // Count the same current registrations used for lifecycle and activity.
            // Registry IDs stay monotonic through clock rollback within one daemon;
            // created_at does not. Reusing inventory also avoids another per-node sort.
            const running = inventory.filter(isEffectivelyRunning);
            const effectiveRunningCount = running.length;
            let earliestRunningAt = null;
            for (const node of running) {
                const createdAt = sessionCreatedAt.get(node.nodeId);
                if (createdAt != null && (earliestRunningAt === null || createdAt < earliestRunningAt))
                    earliestRunningAt = createdAt;
            }
            const status = r.node_count === 0 ? "stopped"
                : effectiveRunningCount === r.node_count ? "running"
                    : effectiveRunningCount > 0 ? "partial"
                        : "stopped";
            const lifecycleState = deriveRigLifecycleFromInventory(inventory);
            // Slice 15 — `terminal-active` count. Subset of running tmux-bound
            // seats whose latest SeatActivity observation says
            // `isActiveWithinWindow === true`. Sourced ONLY from the activity
            // service; never derived from queue state.
            let activeCount = 0;
            if (this.seatActivity) {
                for (const node of inventory) {
                    if (!isEffectivelyRunning(node))
                        continue;
                    if (!node.canonicalSessionName)
                        continue;
                    const obs = this.seatActivity.getSeatActivity(node.canonicalSessionName);
                    if (obs?.isActiveWithinWindow === true)
                        activeCount++;
                }
            }
            // Slice 15 — `has-work-to-do` count. Subset of nodes with at
            // least one pending, in-progress, or blocked qitem whose destination
            // matches either canonical coordinate for the node. Sourced ONLY from the queue
            // projection; never from tmux output.
            // Slice 17: this is the SAME dual-key resolver and active-state map used by
            // per-node inventory. The former single-key/pending-only divergence is gone.
            let hasWorkCount = 0;
            for (const node of inventory) {
                if (countAssignedWorkForEntry(node, assignedByDest).assignedWorkCount > 0)
                    hasWorkCount++;
            }
            // OPR.0.4.4.21 — attention fold, same inventory pass. `needs_input` is
            // read from the ARBITRATED seat state first — the same oracle the
            // per-seat row renders (`activityState` on node-inventory), which also
            // sees pane chrome a hook-silent gated seat never reports. The hook
            // store is the fallback when the arbitrated signal is `null` — service
            // unwired, session not in the ladder, or a `count: 0` that no authoritative
            // needs-input evidence supplied (#180 review; discussion #879); `now` keeps its
            // staleness honest (stale hooks come back `unknown` and contribute
            // nothing). Preferring one source over the other is what let a gated seat
            // show `needs-input x1` on its row while the rig total read ATTN 0.
            let attentionCount = 0;
            const nowDate = new Date(now);
            for (const node of inventory) {
                const session = node.canonicalSessionName;
                const arbitrated = this.seatActivity && session
                    && typeof this.seatActivity.getSeatStateBySession === "function"
                    ? this.seatActivity.getSeatStateBySession(session)
                    : null;
                const activity = this.agentActivity && session
                    ? this.agentActivity.getLatestForNode({ sessionName: session, now: nowDate })
                    : null;
                if (seatNeedsAttention(node, activity, arbitratedNeedsInputSignal(arbitrated)))
                    attentionCount++;
            }
            return {
                rigId: r.rig_id,
                name: r.name,
                rigName: r.name,
                nodeCount: r.node_count,
                runningCount: effectiveRunningCount,
                activeCount,
                hasWorkCount,
                status,
                lifecycleState,
                uptime: earliestRunningAt ? formatDuration(now - new Date(earliestRunningAt + "Z").getTime()) : null,
                latestSnapshot: r.latest_snapshot_at ? formatAge(now - new Date(r.latest_snapshot_at + "Z").getTime()) : null,
                archivedAt: r.archived_at,
                isArchived: r.archived_at !== null,
                periodicSnapshotActive: this.periodicSnapshotActive,
                periodicSnapshotIntervalSeconds: this.periodicSnapshotIntervalSeconds,
                autoPeriodicSnapshotCount: r.auto_periodic_count,
                attentionCount,
            };
        });
    }
}
/**
 * Compatibility helper: count pending-only qitems for one canonical session.
 * The wider assigned-work projection uses countAssignedWorkForSession below.
 */
export function countPendingWorkForSession(db, canonicalSessionName) {
    return countAssignedWorkForSession(db, canonicalSessionName).pendingWorkCount;
}
export function countAssignedWorkForSession(db, canonicalSessionName) {
    return readAssignedWorkBySession(db).get(canonicalSessionName) ?? {
        assignedWorkCount: 0,
        pendingWorkCount: 0,
        inProgressWorkCount: 0,
        blockedWorkCount: 0,
    };
}
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60)
        return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
        return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainMinutes = minutes % 60;
    if (hours < 24)
        return `${hours}h ${remainMinutes}m`;
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    return `${days}d ${remainHours}h`;
}
function formatAge(ms) {
    const dur = formatDuration(ms);
    return `${dur} ago`;
}
//# sourceMappingURL=ps-projection.js.map