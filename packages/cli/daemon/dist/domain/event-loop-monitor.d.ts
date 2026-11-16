/**
 * OPR.0.4.3.21 — daemon event-loop health instrumentation.
 *
 * A daemon can be alive + listening (PID up, port bound) yet have a WEDGED /
 * starved event loop (~100% CPU) so it cannot service requests — `/healthz`
 * goes silent because it runs on the same loop. This monitor is the cheap
 * wedge detector: a continuously-enabled libuv-timer delay histogram
 * (monitorEventLoopDelay) plus a `lastTickAt` timestamp refreshed by a cheap
 * unref'd interval. A starving loop stops firing the interval, so
 * `lastTickAgeMs` grows without bound — the deterministic stall signal.
 *
 * Reuse-first (ponytail): all instrumentation is Node's own `perf_hooks`; no
 * new external primitive. Exposed via the existing `/healthz` surface.
 */
/**
 * Histogram sampling resolution (ms). Node's default for
 * monitorEventLoopDelay; fine enough to catch sub-second stalls at negligible
 * (libuv-timer) overhead.
 */
export declare const EVENT_LOOP_DELAY_RESOLUTION_MS = 10;
/**
 * How often `lastTickAt` is refreshed (ms). 4 Hz is cheap; a wedged loop stops
 * firing this interval, so `lastTickAgeMs` becomes the deterministic stall
 * signal (it grows by real wall-clock time while the loop is blocked).
 */
export declare const EVENT_LOOP_TICK_INTERVAL_MS = 250;
/**
 * Mean event-loop delay (ms) at/above which the loop is considered starved.
 * Anchored to the existing 250 ms healthz-probe timeout: a loop whose mean
 * scheduling delay reaches the probe timeout will start FAILING healthz, so
 * this is the coherent boundary already lived-in by the codebase.
 */
export declare const EVENT_LOOP_LAG_UNHEALTHY_MS = 250;
/**
 * `lastTickAgeMs` (ms) at/above which the loop is considered stalled. 4x the
 * tick interval — an unambiguous stall (four missed ticks), well clear of
 * scheduler jitter, and equal to the healthz retry envelope so a stall this
 * long is one the operator would already be seeing as an unresponsive daemon.
 */
export declare const LAST_TICK_STALE_MS = 1000;
/**
 * The stress-proof bound: under route load `/healthz` MUST answer within this
 * many ms. Same 250 ms anchor — if healthz can't answer within the probe
 * timeout, the CLI already reports the daemon unresponsive, so the proof holds
 * the hot paths to that same responsiveness contract.
 */
export declare const HEALTHZ_RESPONSIVENESS_BUDGET_MS = 250;
export interface EventLoopHealthInput {
    lagMeanMs: number;
    lastTickAgeMs: number;
}
/**
 * Pure health verdict over the two thresholds. Kept pure + exported so the
 * exact boundaries are unit-provable without depending on real event-loop
 * timing (which is inherently non-deterministic).
 */
export declare function evaluateEventLoopHealthy(input: EventLoopHealthInput): boolean;
export interface EventLoopSnapshot {
    /** Mean event-loop delay in ms (histogram mean, ns→ms). */
    lagMeanMs: number;
    /** p99 event-loop delay in ms (ns→ms). */
    lagP99Ms: number;
    /** Event-loop utilization ratio (0..1) over the monitor's lifetime. */
    utilization: number;
    /** Wall-clock ms since the last recorded tick (grows while the loop stalls). */
    lastTickAgeMs: number;
    /** Verdict from {@link evaluateEventLoopHealthy}. */
    healthy: boolean;
}
export interface EventLoopMonitorOptions {
    /** Injectable clock for deterministic tests. Defaults to Date.now. */
    now?: () => number;
    /** Histogram resolution (ms). Defaults to {@link EVENT_LOOP_DELAY_RESOLUTION_MS}. */
    resolutionMs?: number;
    /** lastTick refresh interval (ms). Defaults to {@link EVENT_LOOP_TICK_INTERVAL_MS}. */
    tickIntervalMs?: number;
    /**
     * Start the histogram + tick interval immediately. Default true. Tests pass
     * false to drive `recordTick()` + an injected clock deterministically.
     */
    autoStart?: boolean;
    /** Optional diagnostic observation on the existing tick; never a new timer. */
    onTick?: (at: number, previous: number) => void;
    monotonicNow?: () => number;
}
export declare class EventLoopMonitor {
    private readonly histogram;
    private readonly now;
    private readonly tickIntervalMs;
    private timer;
    private lastTickAt;
    private eluBaseline;
    private started;
    private monotonicTick;
    private readonly monotonicNow;
    private readonly onTick?;
    constructor(opts?: EventLoopMonitorOptions);
    /** Enable the histogram and start the tick interval (unref'd — never holds the process open). */
    start(): void;
    /** Refresh the last-tick timestamp. Exposed for deterministic tests. */
    recordTick(): void;
    snapshot(): EventLoopSnapshot;
    /** Disable the histogram and clear the tick interval. Idempotent. */
    stop(): void;
}
//# sourceMappingURL=event-loop-monitor.d.ts.map