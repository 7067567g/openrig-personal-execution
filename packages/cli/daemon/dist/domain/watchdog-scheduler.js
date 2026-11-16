import { nextDueAt } from "./watchdog-due.js";
export class WatchdogScheduler {
    jobsRepo;
    policyEngine;
    tickIntervalMs;
    now;
    setTimer;
    clearTimer;
    beforeTick;
    onTickError;
    timer = null;
    inflight = null;
    shuttingDown = false;
    started = false;
    constructor(deps) {
        this.jobsRepo = deps.jobsRepo;
        this.beforeTick = deps.beforeTick;
        this.policyEngine = deps.policyEngine;
        this.tickIntervalMs = deps.tickIntervalMs ?? 1000;
        this.now = deps.now ?? (() => new Date());
        this.setTimer = deps.setTimer ?? ((cb, ms) => setTimeout(cb, ms));
        this.clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle));
        this.onTickError = deps.onTickError ?? ((err) => console.error("[watchdog] tick error", err));
    }
    start() {
        if (this.started)
            return;
        this.started = true;
        this.shuttingDown = false;
        this.scheduleNextTick();
    }
    async stop() {
        if (!this.started)
            return;
        this.shuttingDown = true;
        if (this.timer) {
            this.clearTimer(this.timer);
            this.timer = null;
        }
        if (this.inflight) {
            try {
                await this.inflight;
            }
            catch {
                // Errors already logged via onTickError; suppress during shutdown.
            }
        }
        this.started = false;
    }
    isRunning() {
        return this.started && !this.shuttingDown;
    }
    /**
     * Run one tick synchronously (await result). Exposed for tests so
     * they can drive ticks without timers. Production path calls this
     * via the timer loop.
     */
    async runTickNow() {
        if (this.inflight) {
            await this.inflight;
            return;
        }
        this.inflight = this.tick();
        try {
            await this.inflight;
        }
        finally {
            this.inflight = null;
        }
    }
    scheduleNextTick() {
        if (this.shuttingDown)
            return;
        this.timer = this.setTimer(() => {
            void this.runTickNow()
                .catch((err) => this.onTickError(err))
                .finally(() => this.scheduleNextTick());
        }, this.tickIntervalMs);
    }
    async tick() {
        if (this.shuttingDown)
            return;
        const passStartedAt = this.now();
        const nowMs = passStartedAt.getTime();
        this.beforeTick?.();
        const active = this.jobsRepo.listActive();
        for (const job of active) {
            if (this.shuttingDown)
                return;
            if (!isDue(job, nowMs))
                continue;
            try {
                await this.policyEngine.evaluate(job, passStartedAt.toISOString());
            }
            catch (err) {
                this.onTickError(err);
            }
        }
    }
}
/**
 * R1 fix: scan cadence is governed by `scan_interval_seconds` when
 * supplied, falling back to `interval_seconds`. Mirrors POC engine
 * (lib/engine.mjs:38-46) where `last_scan_at` and `scan_interval_seconds`
 * gate the policy invocation. Wake-cadence (`active_wake_interval_seconds`)
 * is enforced one layer up by the policy engine, NOT here.
 */
export function isDue(job, nowMs) {
    const due = nextDueAt(job);
    return due === null || nowMs >= due;
}
//# sourceMappingURL=watchdog-scheduler.js.map