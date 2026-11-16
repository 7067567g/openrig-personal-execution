import { type ServerType } from "@hono/node-server";
import { WakeLadderScheduler } from "./domain/queue-wake-ladder.js";
import type { SlowOperationInstrumentation } from "./domain/slow-op-recorder.js";
import type { ProviderService } from "./domain/provider/provider-service.js";
/** OPR.0.4.3.21 (51elv2) — bound the graceful-shutdown recorder drain. */
export declare const SLOW_OP_SHUTDOWN_DRAIN_TIMEOUT_MS = 5000;
/** P7 — lifecycle heartbeat cadence; last-seen granularity = this interval. */
export declare const HEARTBEAT_INTERVAL_MS = 5000;
/**
 * OPR.0.4.3.21 (51elv2) — drain + close the slow-operation recorder on graceful
 * shutdown and report the process exit code. Returns 0 when the recorder closes
 * cleanly (or is absent), 1 when the drain rejects, times out, or the recorder
 * is in a terminal-failure state — an unproven/lost drain must never look like a
 * clean exit. Bounded by ONE finite timer that stays REFERENCED until the drain
 * settles or times out — it is the only handle that can enforce the bound once
 * the servers and recorder Worker are unreferenced — and is cleared after
 * settlement; adds no retry, queue repair, migration, or supervisor machinery.
 */
export declare function drainSlowOpRecorderOnShutdown(recorder: Pick<SlowOperationInstrumentation, "flush" | "close"> | undefined, opts?: {
    timeoutMs?: number;
    log?: (message: string, error?: unknown) => void;
}): Promise<number>;
/** OPR.0.3.4.9 — extracted for testability. Starts the periodic snapshot
 *  scheduler and updates the ps-projection status when enabled. */
export declare function startPeriodicSnapshotScheduler(deps: {
    periodicSnapshotScheduler?: {
        start(intervalMs: number, retentionKeep: number): void;
    };
    psProjectionService: {
        setPeriodicSnapshotState(active: boolean, intervalSeconds: number): void;
    };
    settingsStore?: {
        resolveOne(key: string): {
            value: unknown;
        };
    };
}): void;
/** OPR.0.4.6.FS-1 W2 — start the queue-retention maintenance sweep (arch D3): a
 *  boot sweep + a daily tick that archives aged terminal `queue_transitions`
 *  (never-delete) and prunes `watchdog_history`, both in bounded batches with
 *  event-loop yields. Reads the `retention.*` settings (baked defaults via
 *  RETENTION_DEFAULTS). Fire-and-forget with error logging — a sweep failure must
 *  never crash the daemon. Returns the daily interval handle (cleared on
 *  shutdown), or null when disabled. */
export declare function startQueueRetentionScheduler(deps: {
    rigRepo: {
        db: import("better-sqlite3").Database;
    };
    settingsStore?: {
        resolveOne(key: string): {
            value: unknown;
        };
    };
}): ReturnType<typeof setInterval> | null;
/** S02 (OPR.0.5.5.2) — start the STANDING STUCK SWEEP: both halves of "is anything
 *  silently stuck" (claimed-never-closed; sender-believed-delivered-never-woken) plus the
 *  unclaimed-obligation net and the dangling-closure custody class, on the config-keyed
 *  cadence (`queue.stuck_sweep_interval_seconds`). Findings route as durable rows to the
 *  owning seats; a clean sweep records only the healthz heartbeat; a failing sweep is loud
 *  on that surface and the log, never a silent skip. Boot sweep + interval, retention
 *  pattern. Returns the interval handle (cleared on shutdown), or null when the queue
 *  repository is absent (direct-construction harnesses). */
export declare function startStuckSweepScheduler(deps: {
    rigRepo: {
        db: import("better-sqlite3").Database;
    };
    queueRepo?: import("./domain/queue-repository.js").QueueRepository;
    stuckSweepStatus?: import("./domain/queue-stuck-sweep.js").StuckSweepStatus;
}): ReturnType<typeof setInterval> | null;
/** S01 (OPR.0.5.5.1) — start the WAKE-OR-ESCALATE ladder: batons whose wake failed retry
 *  on the config-keyed cadence up to the cap, then escalate through recorded rungs
 *  (destination's orchestrator — aggregated per destination — then the operator surface).
 *  Ladder state derives entirely from the row's transitions, so a daemon restart resumes
 *  every ladder at its exact position with no recovery step. Returns the scheduler
 *  (stopped on shutdown), or null when the queue repository is absent. */
export declare function startWakeLadderScheduler(deps: {
    rigRepo: {
        db: import("better-sqlite3").Database;
    };
    queueRepo?: import("./domain/queue-repository.js").QueueRepository;
    wakeLadderStatus?: import("./domain/queue-wake-ladder.js").WakeLadderStatus;
    providerService?: Pick<ProviderService, "getReadModel">;
    usageLimitJitterSeconds?: number;
    seatActivityService?: Pick<import("./domain/seat-activity-service.js").SeatActivityService, "getSeatState">;
    agentActivityStore?: Pick<import("./domain/agent-activity-store.js").AgentActivityStore, "getLatestForNode">;
    gatewaySubsystem?: {
        dispatch: (op: string, entityBindingRef: string, payload: unknown, opts?: {
            decisionId?: string;
        }) => import("./domain/gateway/dispatcher.js").DispatchResult;
    };
}): WakeLadderScheduler | null;
export declare function startServer(port?: number): Promise<ServerType>;
//# sourceMappingURL=index.d.ts.map