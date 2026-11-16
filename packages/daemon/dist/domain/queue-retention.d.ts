import type Database from "better-sqlite3";
/**
 * OPR.0.4.6 FS-1 (daemon read-path hardening) — W2 retention/prune runner.
 *
 * Two tables, two CONTRACTS (arch D3 — never collapsed into one policy):
 *
 *  1. `queue_transitions` = an AUDIT surface with product meaning (chain of
 *     record; `rig queue resolve` decision text). Contract: ARCHIVE, never
 *     plain-delete. A terminal qitem whose LAST transition is older than the
 *     retention window is MOVED (INSERT..SELECT + DELETE in ONE txn) into the
 *     `queue_transitions_archive` sibling (migration 054) — the trail is
 *     preserved, queryable in place, never lost.
 *     THE ACTIVE-FRONTIER INVARIANT (binding, testable): transitions of any
 *     NON-terminal qitem are NEVER touched, at any age. Enforced structurally —
 *     only qitems whose `queue_items.state` is terminal are ever selected.
 *
 *  2b. `usage_samples` (51-08 A2) = telemetry, same contract as watchdog_history:
 *     plain bounded DELETE past the PM-ruled 14d default (`retention.usage_samples_days`).
 *  2. `watchdog_history` = telemetry, no audit contract. Contract: plain DELETE
 *     older than the window, PLUS keep the most recent K per job regardless of
 *     age (respects `idx_watchdog_history_job_recent`, the recent-per-job reader).
 *
 * Runner mechanics: a boot-time sweep + a daily in-daemon maintenance tick (NOT
 * a watchdog policy). Every DB pass is a BOUNDED batch (LIMIT-ed) and the async
 * orchestrator yields to the event loop between batches, so the prune itself can
 * NEVER wedge the loop — the fix must not carry the disease it cures. `nowIso` is
 * injectable for deterministic VM seeding.
 *
 * HONESTY LINE (arch F3): this bounds DB growth, backup size, and any
 * transitions-reading surface. It does NOT move `/api/ps` latency (that is W1's
 * sessions index + N+1 collapse). Kept separate so the ship-gate credits the
 * right fix.
 *
 * ── REBASE-RECONCILE (this module is greenfield-authored on worktree 384e60f1;
 *    the following land against the merged tip, per PLAN §J/§K, NOT this stale
 *    checkout) ──
 *  • P1 — ONE SHARED TERMINAL PREDICATE. Today `queue-repository.ts` has the
 *    terminal set only as INLINE literals (`state === "done" || state ===
 *    "handed-off"` at :522/:663 here; arch cites :550/:691/:1058 at the merged
 *    tip a6c27e74). At rebase, export a single named `TERMINAL_QUEUE_STATES`
 *    from queue-repository, refactor those inline sites to consume it, and
 *    replace this module's local `DEFAULT_TERMINAL_STATES` with that import — a
 *    pure-naming, byte-identical change swept by FUNCTION not line#. Until then
 *    the local default IS the code's terminal set (`['done','handed-off']`), so
 *    behavior is identical; only the SSOT wiring is deferred.
 *  • P2 — FRONTIER-LIVENESS EXCLUSION. Add one WHERE clause (+ one named test)
 *    excluding any qitem referenced in a NON-terminal workflow instance's
 *    current frontier, regardless of state/age. This is active protection for
 *    packet-addressed parallel frontiers; serial close mechanics remain covered
 *    by the same predicate.
 *  • WIRING — register the retention settings keys in `SETTINGS_VALID_KEYS`
 *    (settings-store) and call `runQueueRetentionSweep` from the daemon's
 *    maintenance scheduler (where the watchdog runner is started, index.ts/
 *    server.ts) at boot + on a daily tick. Both integration points live at the
 *    merged tip; wired there.
 */
/**
 * The queue's terminal state set — P1 LANDED: sourced from the SINGLE shared
 * `TERMINAL_QUEUE_STATES` SSOT exported by queue-repository (the same predicate
 * the queue's own closure guards consume via `isTerminalState`), so a future
 * terminal-state addition can never silently diverge the archiver from the queue
 * (arch D3-REFINEMENT P1; widen-never-sibling). `['done','handed-off']` is the
 * full terminal set — done-only would exempt the highest-volume class (workflow
 * step closures exit `handoff -> state=handed-off`).
 */
export declare const DEFAULT_TERMINAL_STATES: readonly ["done", "handed-off"];
/** Retention defaults (arch D3). BAKED closed-set knobs — registered as settings
 *  keys at rebase; no free-form config. */
export declare const RETENTION_DEFAULTS: {
    /** archive terminal transitions whose last transition is older than this */
    readonly transitionsRetentionDays: 30;
    /** delete watchdog_history older than this ... */
    readonly watchdogRetentionDays: 14;
    /** ... EXCEPT always keep this many most-recent rows per job */
    readonly watchdogKeepPerJob: 50;
    /** delete usage_samples telemetry older than this (51-08 A2, PM decision 2) */
    readonly usageSamplesRetentionDays: 14;
    /** rows/qitems touched per bounded batch (the anti-wedge bound) */
    readonly batchSize: 500;
    /** safety cap on batches per table per sweep (defense-in-depth vs a runaway loop) */
    readonly maxBatchesPerTable: 10000;
};
export interface RetentionOptions {
    /** injected clock (ISO-8601); deterministic for VM seeding */
    nowIso: string;
    terminalStates?: readonly string[];
    transitionsRetentionDays?: number;
    watchdogRetentionDays?: number;
    watchdogKeepPerJob?: number;
    usageSamplesRetentionDays?: number;
    batchSize?: number;
    maxBatchesPerTable?: number;
}
export interface ArchiveBatchResult {
    /** distinct terminal qitems whose transitions were archived this batch */
    archivedQitems: number;
    /** transition rows moved this batch */
    archivedRows: number;
}
/**
 * ONE bounded batch: move (archive-then-delete, single txn per qitem) the
 * transitions of up to `batchSize` TERMINAL qitems whose LAST transition is
 * older than the cutoff. Returns the counts so the orchestrator can loop until
 * a batch is empty. Non-terminal qitems are never selected (active-frontier
 * invariant, structural).
 */
export declare function archiveAgedTerminalTransitions(db: Database.Database, opts: RetentionOptions): ArchiveBatchResult;
export interface PruneBatchResult {
    /** watchdog_history rows deleted this batch */
    deletedRows: number;
}
/**
 * ONE bounded batch: DELETE up to `batchSize` watchdog_history rows that are
 * older than the cutoff AND outside the most-recent-K per job. The per-job
 * recency rank rides idx_watchdog_history_job_recent (job_id, evaluated_at DESC).
 * Count strictly newer rows so exact-timestamp ties at the keep boundary
 * over-KEEP (never over-delete) — the safe direction.
 */
export declare function pruneWatchdogHistory(db: Database.Database, opts: RetentionOptions): PruneBatchResult;
/**
 * 51-08 A2 — ONE bounded batch: DELETE up to `batchSize` usage_samples rows
 * whose captured_at predates the retention cutoff (PM-ruled default 14d,
 * tunable). usage_samples is TELEMETRY under the watchdog_history contract —
 * plain delete, no audit archive. A seat idle past the window loses its rows;
 * the query surfaces render honest-unknown, never a preserved stale value.
 * `<` semantics: an exact-cutoff row survives (over-keep, the safe direction).
 */
export declare function pruneUsageSamples(db: Database.Database, opts: RetentionOptions): PruneBatchResult;
export interface RetentionSweepSummary {
    archivedQitems: number;
    archivedRows: number;
    watchdogDeleted: number;
    usageSamplesDeleted: number;
    transitionBatches: number;
    watchdogBatches: number;
    usageSamplesBatches: number;
}
/**
 * The boot-sweep / daily-tick entry point: drain both retention passes in
 * bounded batches, yielding to the event loop between batches so a large
 * backlog can never wedge the daemon. Idempotent and safe to run on every boot.
 * Each pass stops when a batch is empty or the safety batch-cap is hit.
 */
export declare function runQueueRetentionSweep(db: Database.Database, opts: RetentionOptions): Promise<RetentionSweepSummary>;
//# sourceMappingURL=queue-retention.d.ts.map