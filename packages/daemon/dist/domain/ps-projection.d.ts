import type Database from "better-sqlite3";
import type { AgentActivity, NodeInventoryEntry, NodeLifecycleState, RigLifecycleState } from "./types.js";
import { type AssignedWorkCounts } from "./node-inventory.js";
import { type RigArchiveFilter } from "./rig-repository.js";
import type { SeatActivityService } from "./seat-activity-service.js";
import type { AgentActivityStore } from "./agent-activity-store.js";
import type { ArbitratedSeatState } from "./activity-taxonomy.js";
export interface PsEntry {
    rigId: string;
    name: string;
    /**
     * Alias of `name`. Always populated and always equal to `name`.
     *
     * Background: per-node `NodeInventoryEntry` exposes the rig's name as
     * `rigName` while rig-summary `PsEntry` historically used `name`. Agent
     * code that projects `.rigName` from rig-summary JSON saw silent
     * `null`/`undefined`. This alias closes that inconsistency without
     * breaking existing consumers reading `.name`.
     */
    rigName: string;
    nodeCount: number;
    runningCount: number;
    /**
     * Slice 15 — count of nodes whose `terminal-active` primitive
     * reports `isActiveWithinWindow === true`. PARALLEL to `runningCount`
     * (which stays `process-alive` semantics). Sourced exclusively from
     * the SeatActivityService; never from queue/assignment state.
     */
    activeCount: number;
    /**
     * Slice 15 — count of nodes whose `has-work-to-do` primitive reports
     * `hasAssignedWork === true`. Derived from active queue items
     * with `destination_session` matching either of the node's canonical
     * coordinates. Independent from `activeCount` (non-inference contract).
     */
    hasWorkCount: number;
    status: "running" | "partial" | "stopped";
    /** Folded from members not explicitly stopped. Empty rigs and rigs whose
     * members are all intentionally stopped derive `stopped`. */
    lifecycleState: RigLifecycleState;
    uptime: string | null;
    latestSnapshot: string | null;
    /** OPR.0.3.3.19 - ISO timestamp when the rig was archived, or null if active. */
    archivedAt: string | null;
    /** OPR.0.3.3.19 - convenience flag; true iff `archivedAt !== null`. */
    isArchived: boolean;
    /** OPR.0.3.4.9 — periodic snapshot floor: whether the scheduler is active. */
    periodicSnapshotActive: boolean;
    /** OPR.0.3.4.9 — periodic snapshot interval in seconds (0 if inactive). */
    periodicSnapshotIntervalSeconds: number;
    /** OPR.0.3.4.9 — count of auto-periodic snapshots for this rig. */
    autoPeriodicSnapshotCount: number;
    /**
     * OPR.0.4.4.21 — count of seats needing attention (additive field; the
     * consolidated default's ATTENTION flag and the host rollup's "K need
     * attention" both read it). A seat counts ONCE when ANY signal in
     * `seatNeedsAttention` fires. Folded inside the same per-rig inventory
     * pass as `lifecycleState` — no extra probes.
     */
    attentionCount: number;
}
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
export declare function seatNeedsAttention(entry: NodeInventoryEntry, activity: AgentActivity | null, arbitratedNeedsInput?: boolean | null): boolean;
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
export declare function arbitratedNeedsInputSignal(state: Pick<ArbitratedSeatState, "needsInput" | "needsInputEvidence"> | null): boolean | null;
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
export declare function deriveRigLifecycleState(nodeStates: NodeLifecycleState[]): RigLifecycleState;
/** Shared display rollup for ps and the rig summaries consumed by the TUI.
 * Intentionally stopped seats remain in process counts and node diagnostics. */
export declare function deriveRigLifecycleFromInventory(inventory: readonly Pick<NodeInventoryEntry, "lifecycleState" | "intentionallyStopped">[]): RigLifecycleState;
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
export declare function isEffectivelyRunning(node: NodeInventoryEntry): boolean;
/**
 * Projects rig/run summary for `rig ps`.
 * Aggregates across all rigs: node counts, running counts, status, uptime, snapshot age.
 */
export declare class PsProjectionService {
    readonly db: Database.Database;
    private readonly seatActivity;
    /** OPR.0.4.4.21 — synchronous hook-activity lookup for the attention
     *  predicate's `needs_input` signal. Optional: absent → the signal
     *  contributes false (honest degrade), never a guess. */
    private readonly agentActivity;
    private periodicSnapshotActive;
    private periodicSnapshotIntervalSeconds;
    constructor(deps: {
        db: Database.Database;
        seatActivity?: SeatActivityService;
        agentActivity?: AgentActivityStore;
    });
    setPeriodicSnapshotState(active: boolean, intervalSeconds: number): void;
    getEntries(filter?: RigArchiveFilter): PsEntry[];
}
/**
 * Compatibility helper: count pending-only qitems for one canonical session.
 * The wider assigned-work projection uses countAssignedWorkForSession below.
 */
export declare function countPendingWorkForSession(db: Database.Database, canonicalSessionName: string): number;
export declare function countAssignedWorkForSession(db: Database.Database, canonicalSessionName: string): AssignedWorkCounts;
//# sourceMappingURL=ps-projection.d.ts.map