import type { WatchdogJob, WatchdogJobsRepository } from "./watchdog-jobs-repository.js";
import type { WatchdogPolicyEngine } from "./watchdog-policy-engine.js";
/**
 * Watchdog scheduler (PL-004 Phase C; daemon-native supervision tree
 * member). Joins createDaemon's lifecycle: started by startup.ts after
 * the policy engine is ready, stopped during graceful shutdown.
 *
 * Loop semantics:
 *   - Wakes every `tickIntervalMs` (default 1000) and queries the
 *     repository for active jobs whose `interval_seconds` has elapsed
 *     since `last_evaluation_at` (or who have never been evaluated).
 *   - For each due job, calls policyEngine.evaluate(job). The engine
 *     records meaningful outcomes; pure not-due polls are filtered
 *     here and never reach history.
 *   - SQLite is the canonical schedule state — restart recovery is
 *     automatic: on startup, `listActive()` returns the same set
 *     and `last_evaluation_at` determines next-due.
 *
 * Concurrency:
 *   - One in-flight tick at a time. If a tick takes longer than
 *     tickIntervalMs (long policy.evaluate or slow delivery), the
 *     next tick is delayed; we don't queue overlapping ticks.
 *   - Within a tick, jobs are evaluated sequentially. This bounds
 *     resource use and matches the POC's single-loop behavior.
 *
 * Shutdown:
 *   - stop() sets shuttingDown=true, clears the timer, and awaits the
 *     in-flight tick (if any). Idempotent.
 */
export interface WatchdogSchedulerDeps {
    jobsRepo: WatchdogJobsRepository;
    policyEngine: WatchdogPolicyEngine;
    /** Tick wake-up cadence. Default 1000 ms. */
    tickIntervalMs?: number;
    /** Override clock for tests. */
    now?: () => Date;
    /** Override timer scheduler for tests. */
    setTimer?: (cb: () => void, ms: number) => NodeJS.Timeout;
    clearTimer?: (handle: NodeJS.Timeout) => void;
    /** Reconcile durable domain state before taking the due-job snapshot. */
    beforeTick?: () => void;
    /** Notification on tick errors (for telemetry; defaults to console.error). */
    onTickError?: (err: unknown) => void;
}
export declare class WatchdogScheduler {
    private readonly jobsRepo;
    private readonly policyEngine;
    private readonly tickIntervalMs;
    private readonly now;
    private readonly setTimer;
    private readonly clearTimer;
    private readonly beforeTick?;
    private readonly onTickError;
    private timer;
    private inflight;
    private shuttingDown;
    private started;
    constructor(deps: WatchdogSchedulerDeps);
    start(): void;
    stop(): Promise<void>;
    isRunning(): boolean;
    /**
     * Run one tick synchronously (await result). Exposed for tests so
     * they can drive ticks without timers. Production path calls this
     * via the timer loop.
     */
    runTickNow(): Promise<void>;
    private scheduleNextTick;
    private tick;
}
/**
 * R1 fix: scan cadence is governed by `scan_interval_seconds` when
 * supplied, falling back to `interval_seconds`. Mirrors POC engine
 * (lib/engine.mjs:38-46) where `last_scan_at` and `scan_interval_seconds`
 * gate the policy invocation. Wake-cadence (`active_wake_interval_seconds`)
 * is enforced one layer up by the policy engine, NOT here.
 */
export declare function isDue(job: WatchdogJob, nowMs: number): boolean;
//# sourceMappingURL=watchdog-scheduler.d.ts.map