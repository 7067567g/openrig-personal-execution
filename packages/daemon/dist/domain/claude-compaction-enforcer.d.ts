import type { SessionTransport } from "./session-transport.js";
import type { SettingsStore } from "./user-settings/settings-store.js";
/**
 * Slice 27 — Claude auto-compaction policy enforcer.
 *
 * Decides per-seat whether ContextMonitor should send `/compact` based on
 * operator-configured policy (`policies.claude_compaction.*` settings).
 * Decoupled from ContextMonitor's scheduling concern so it can be tested
 * + composed independently.
 *
 * Risk class: compaction lifecycle is load-bearing (banked permission-layer
 * foot-gun rule extends to any agent-runtime trigger). Defensive contract:
 *
 * - Opt-in default-off: `enabled=false` → never triggers. Verified by
 *   regression test HG-5.
 * - Runtime filter: triggers only when runtime === "claude-code". Codex
 *   compacts cleanly via its own runtime per agent-startup-guide; other
 *   runtimes are out of scope.
 * - Re-arm: after a successful pre-compaction prep + /compact send, the
 *   session must drop below threshold before another auto-compact can
 *   fire. The dedup window still blocks immediate flaps; the threshold
 *   crossing rule prevents one high-usage session from receiving
 *   /compact every 60s. State is intentionally NOT persisted; daemon
 *   restart resets the window which is the safer-failure direction
 *   (might re-compact once on restart in rare cases, won't lock out
 *   forever).
 * - Definite pre-write prep failures retry at most three times. Uncertain
 *   delivery never replays. Unfinished preparation stops visibly until an
 *   explicit retry; it cannot arm a delayed compact after its deadline.
 * - Pre-compact prep: the first threshold crossing sends a normal
 *   user-channel prompt asking Claude to load the restore skill and
 *   write an attempt-bound restore map. Existing polls send /compact only after
 *   atomic publication of that completed artifact, within the preparation deadline.
 * - Post-compact restore: after a successful auto-compact, the enforcer
 *   first sends a turn-boundary handshake once context usage drops below
 *   threshold, or when the latest sample is stale or unknown (a seat that
 *   takes no turn after /compact never refreshes its sample), then sends the
 *   restore prompt on a later polling tick.
 *   This is intentionally active because Claude hooks can provide
 *   context, but they do not create a new assistant turn by themselves.
 */
export declare const DEDUP_WINDOW_MS_DEFAULT = 60000;
export declare const POST_COMPACT_RESTORE_COOLDOWN_MS_DEFAULT: number;
export declare const MANUAL_PREP_WAIT_MS_DEFAULT = 120000;
export declare const AUTO_PREP_WAIT_MS_DEFAULT: number;
export declare const POST_COMPACT_SEND_WAIT_MS_DEFAULT = 10000;
export interface EnforcerInput {
    sessionName: string;
    /** Registered launch workspace, shared by the manual route and context monitor. */
    cwd?: string | null;
    runtime: string | null;
    usedPercentage: number | null;
    transcriptPath?: string | null;
    sessionId?: string | null;
    /** Revalidate a poll's source snapshot after acquiring the delivery lease. */
    isObservationCurrent?: () => boolean;
}
export type EnforcerOutcome = {
    triggered: true;
} | {
    triggered: false;
    reason: EnforcerSkipReason;
};
/**
 * OPR.0.4.3.14 — manual compaction trigger surfaced stages (AC-3). `preparing`
 * and `compact-sent` are set synchronously by `triggerManualCompact`; the
 * later `restore-sent` / `audit-sent` are advanced by the EXISTING post-compact
 * back-half (drained by the ContextMonitor poll loop) as it drains — never a
 * second restore path. `skipped-or-failed` carries the reason.
 */
export type ManualCompactionStage = "preparing" | "compact-sent" | "restore-sent" | "audit-sent" | "skipped-or-failed";
export interface ManualCompactionStatus {
    stage: ManualCompactionStage;
    reason?: string;
    updatedAt: number;
    /** GHOST-STAGE fix (a) — was this manual sequence started by a real OPERATOR (vs automation
     *  calling the manual verb)? Only an operator-initiated sequence is exempt from the disabled
     *  drain gate; automation is NOT exempt (PM pin — the exemption must not launder a drain). */
    operatorInitiated?: boolean;
}
export type ManualCompactionOutcome = {
    triggered: true;
    stage: "compact-sent";
} | {
    triggered: false;
    stage: "skipped-or-failed";
    reason: string;
    preparation?: Pick<PreparationState, "attemptId" | "mapPath" | "delivery">;
};
export type EnforcerSkipReason = "typing_guard_enabled" | "guard_target_unknown" | "guard_target_changed" | "runtime_filter" | "no_usage_data" | "disabled" | "below_threshold" | "already_triggered_above_threshold" | "dedup_window" | "post_restore_cooldown" | "send_failed" | "invalid_policy" | "stale_generation" | "stale_observation" | "preparation_pending" | "preparation_incomplete" | "preparation_stopped" | "occupant_generation_unavailable" | "no_pending_stage";
/** Out-of-contract thresholds (0, 101, NaN, a non-integer) are treated as disabled. */
export declare function isValidThresholdPercent(value: unknown): boolean;
export declare function buildCompactCommand(compactInstruction: string): string;
export declare function buildPostCompactRestorePrompt(input: {
    sessionName: string;
    openrigHome: string;
    transcriptPath?: string | null;
    sessionId?: string | null;
    postCompactInstruction?: string | null;
    postCompactInstructionFilePath?: string | null;
    ignoredWrongSeatExtra?: boolean;
}): string;
export declare function buildPostCompactTurnBoundaryPrompt(): string;
export interface PreparationState {
    attemptId: string;
    occupantGeneration: string | null;
    mapPath: string;
    marker: string;
    mode: "automatic" | "manual";
    status: "sending" | "waiting" | "stopped" | "compact-sent";
    delivery: "pending" | "not_sent" | "delivered" | "uncertain";
    deadlineAt: number | null;
    reason?: string;
}
export declare class ClaudeCompactionEnforcer {
    private readonly settingsStore;
    private readonly sessionTransport;
    private readonly dedupWindowMs;
    private readonly postCompactRestoreCooldownMs;
    private readonly openrigHome;
    private readonly manualPrepWaitMs;
    private readonly now;
    private readonly sleep;
    private readonly postCompactSendWaitMs;
    private readonly lastAutoCompactAt;
    private readonly postCompactRestoreCooldownUntil;
    private readonly triggeredAboveThreshold;
    private readonly pendingPreCompactPrep;
    private readonly pendingPostCompactRestore;
    private readonly manualCompactionState;
    private readonly pendingStageGeneration;
    private readonly resolveOccupantGeneration?;
    private readonly onPostRestoreComplete?;
    constructor(settingsStore: SettingsStore, sessionTransport: SessionTransport, opts?: {
        dedupWindowMs?: number;
        openrigHome?: string;
        postCompactRestoreCooldownMs?: number;
        manualPrepWaitMs?: number;
        now?: () => number;
        sleep?: (ms: number) => Promise<void>;
        postCompactSendWaitMs?: number;
        resolveOccupantGeneration?: (sessionName: string) => string | null;
        onPostRestoreComplete?: (receipt: {
            sessionName: string;
            occupantGeneration: string | null;
            postRestoreUsedPercentage: number;
            saturationBoundPercentage: number;
        }) => Promise<void> | void;
    });
    /**
     * Inspect a single observation and trigger /compact when policy says so.
     * Safe to call on every poll tick; non-eligible inputs return early
     * with a skip reason and never touch SessionTransport.
     */
    maybeAutoCompact(input: EnforcerInput): Promise<EnforcerOutcome>;
    /** True while a post-compact stage (turn boundary, restore or audit) is still owed to this seat. */
    hasPendingPostCompactStage(sessionName: string): boolean;
    /**
     * Drain a post-compact stage that is already pending, without a usage sample. ContextMonitor
     * calls this when the latest sample is stale or unknown. Such a sample never starts a
     * compaction, but a seat that takes no turn after /compact never refreshes its sample, so
     * waiting for a fresh one can leave it unrestored. The same gates and the same
     * one-stage-per-tick progression apply as on the sampled path. Each send waits for the pane
     * itself to read idle: the newest hook can be the Stop from before /compact, so no hook counts
     * as proof that compaction finished. No width receipt is recorded, because no current usage is
     * known.
     */
    drainPendingPostCompactStage(input: Omit<EnforcerInput, "usedPercentage">): Promise<EnforcerOutcome>;
    private withDeliveryGuard;
    /**
     * Gate and send the pending post-compact stage, one stage per call. Returns null when no stage
     * is pending, so the sampled path can run its below-threshold bookkeeping.
     */
    private drainPendingStage;
    private maybeAutoCompactUnchecked;
    /**
     * OPR.0.4.3.14 — MANUAL, operator-initiated compaction for ONE Claude seat.
     *
     * Runs the SAME guided lifecycle as the auto policy (pre-compact prep →
     * `/compact` + trust-bridge → restore → read-depth audit) on demand, WITHOUT
     * the threshold gate and WITHOUT the `enabled` gate (an explicit operator
     * action). Reuse-correct:
     *
     * - SAME prompt builders + SAME configured messages (`resolveClaudeCompactionPolicy`).
     * - Wait for this attempt's map, then the existing idle observation, within one
     *   120-second budget. Neither wait holds the seat input lease. Final writes
     *   recheck the attempt, policy and occupant; marker presence is not map quality.
     * - Seeds the EXISTING `pendingPostCompactRestore` back-half state machine,
     *   drained by the same ContextMonitor poll loop as an auto-compact — there is
     *   NO second restore path.
     * - Non-Claude runtime → rejected with a clear reason (never a silent no-op).
     * - Bounded to the one triggered seat; no fan-out, no broadcast.
     */
    triggerManualCompact(input: EnforcerInput, opts?: {
        operatorInitiated?: boolean;
        skipMap?: boolean;
    }): Promise<ManualCompactionOutcome>;
    private triggerManualCompactUnchecked;
    private beginPreparation;
    private mapReady;
    private deliverPreparation;
    private sendPreparedCompact;
    /** Existing monitor polls and manual waits call this even when context usage is stale. */
    reconcilePreparations(): void;
    private stopPreparation;
    cancelPreparation(session: string): PreparationState | null;
    getPreparationState(session: string): PreparationState | null;
    /** OPR.0.4.3.14 — read the surfaced manual-trigger state for a seat (AC-3). */
    getManualCompactionState(sessionName: string): ManualCompactionStatus | null;
    /**
     * GHOST-STAGE (e) Class-A invalidation: drop EVERY in-memory compaction-state entry for one seat
     * name, so a handed-over successor under the same session name never inherits the predecessor's
     * queued stage / dedup / cooldown (the ghost prompt). Called by the cutover seam's
     * OccupantInvalidator at SeatHandoverService.commit(). Also closes the manualCompactionState leak
     * (census 1f): that map was NEVER deleted on drain, so a same-name successor read a stale terminal
     * record. Occupant-scoped (no atom-B): the retiring occupant is gone, so a name match IS the ghost.
     */
    invalidateOccupant(sessionName: string): void;
    private setManualStage;
    private recordManualFailure;
    /**
     * Advance the surfaced manual stage monotonically, and ONLY when the current
     * stage matches `from`. This makes the back-half updates a no-op for auto
     * seats (no manual record) and prevents a later auto-compact drain from
     * misattributing itself to a completed manual trigger (its stage is already
     * `audit-sent`, so no `from` matches).
     */
    private advanceManualStage;
}
//# sourceMappingURL=claude-compaction-enforcer.d.ts.map