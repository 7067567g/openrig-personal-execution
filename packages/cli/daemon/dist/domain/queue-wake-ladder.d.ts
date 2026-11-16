import type { ArbitratedSeatState } from "./activity-taxonomy.js";
import type { AgentActivity } from "./types.js";
import type { OperatorDeliveryEngine } from "./gateway/operator-delivery-engine.js";
import { type WaitingView } from "./queue-waiting.js";
import type Database from "better-sqlite3";
import type { QueueItem, QueueRepository } from "./queue-repository.js";
import type { FourBlockReadModel } from "./provider/provider-types.js";
import { type LoadResult } from "./gateway/human-registry.js";
export declare const WAKE_RETRY_INTERVAL_KEY = "queue.wake_retry_interval_seconds";
export declare const DEFAULT_WAKE_RETRY_INTERVAL_SECONDS = 300;
export declare const WAKE_RETRY_CAP_KEY = "queue.wake_retry_cap";
export declare const DEFAULT_WAKE_RETRY_CAP = 3;
export declare const WAKE_UNCONFIRMED_WINDOW_KEY = "queue.wake_unconfirmed_window_minutes";
export declare const DEFAULT_WAKE_UNCONFIRMED_WINDOW_MINUTES = 30;
export declare const WAKE_SWAP_GRACE_KEY = "queue.wake_swap_grace_seconds";
export declare const DEFAULT_WAKE_SWAP_GRACE_SECONDS = 180;
/** Whether the operator rung posts agent-to-agent escalations to a person.
 *  "always" (default) keeps today's behavior; "explicit-only" ends the ladder at
 *  the escalation row (operator seat or rig lead) unless the row's destination is
 *  a person: any `@external` address, or one the human registry resolves to a
 *  person. An ask that needs a person must be addressed to the person. An instance
 *  that has never set up the human registry can't read it, so there explicit-only
 *  posts everything, as "always" does. */
export declare const WAKE_HUMAN_RUNG_KEY = "queue.wake_human_rung";
export type WakeHumanRung = "always" | "explicit-only";
export declare const DEFAULT_WAKE_HUMAN_RUNG: WakeHumanRung;
export declare const USAGE_LIMIT_JITTER_FLOOR_SECONDS = 30;
export declare const USAGE_LIMIT_JITTER_CEILING_SECONDS = 90;
export declare function drawUsageLimitJitterSeconds(random?: () => number): number;
/** The operator-declared suspension override (F2: override, never the mechanism).
 *  Format: comma-separated `<session>:<untilIso>` pairs; fresh-read every tick. */
export declare const WAKE_SUSPEND_OVERRIDE_ENV = "OPENRIG_WAKE_SUSPEND";
/** Stamp tag on the per-destination aggregate escalation row. */
export declare const WAKE_ESCALATION_TAG = "wake-escalation";
export declare function escalationDedupTag(destination: string): string;
export declare const LADDER_SUSPEND_PREFIX = "ladder-suspend:";
export declare const LADDER_RESUME_PREFIX = "ladder-resume:";
export interface WakeLadderStatusSnapshot {
    lastTickAt: string | null;
    lastOutcome: "clean" | "actions" | "failed" | null;
    lastError: string | null;
    consecutiveFailures: number;
    activeLadders: number;
    escalationsOpen: number;
    exhaustedTotal: number;
}
export interface WakeLadderStatus {
    record(outcome: "clean" | "actions" | "failed", detail?: {
        error?: string;
        active?: number;
        escalations?: number;
        exhausted?: number;
    }): void;
    snapshot(): WakeLadderStatusSnapshot;
}
/** The loop's observable heartbeat — rides /healthz beside the S02 sweep's. */
export declare function createWakeLadderStatus(): WakeLadderStatus;
export declare const resolveWakeRetryIntervalSeconds: () => number;
export declare const resolveWakeRetryCap: () => number;
export declare const resolveWakeUnconfirmedWindowMinutes: () => number;
export declare const resolveWakeSwapGraceSeconds: () => number;
export declare function resolveWakeHumanRung(): WakeHumanRung;
export interface WakeLadderDeps {
    db: Database.Database;
    queueRepo: QueueRepository;
    status?: WakeLadderStatus;
    /** Attempt a wake to `target` for `qitemId`; returns the outcome in the queue nudge
     *  grammar (verified | delivered-ack-pending | indeterminate:* | failed:*). Default
     *  rides maybeNudge — the wake is the envelope pointer, never the content. */
    attemptWake?: (qitemId: string, target: string) => Promise<string>;
    resolveOrchestrator?: (session: string) => string | null;
    retryIntervalSeconds?: number;
    retryCap?: number;
    unconfirmedWindowMinutes?: number;
    swapGraceSeconds?: number;
    /** Shipped provider telemetry, injected by the daemon. Absent/read failure keeps
     *  every pre-S16 ladder path byte-identical. */
    getProviderReadModel?: () => Promise<Pick<FourBlockReadModel, "signals" | "bindings">>;
    usageLimitJitterSeconds?: number;
    /** Cached arbitrated activity only: no new probe or native input. */
    readPromptState?: (destination: string, refusedAt: string) => "blocked" | "clear" | "unknown";
    now?: Date;
    log?: (line: string) => void;
    /** OPR.0.5.6.1 — the operator rung's delivery leg. dispatchEscalation delivers
     *  (or defers) through the rules engine and reports whether the outcome
     *  resolved synchronously; absent = pre-engine floor behavior. */
    deliveryEngine?: OperatorDeliveryEngine;
    /** Defaults to the queue.wake_human_rung setting. */
    humanRung?: WakeHumanRung;
    /** The human registry the explicit-only rung uses to tell a handoff addressed to a
     *  person from agent-to-agent work. Defaults to the daemon's registry. */
    loadHumanRegistry?: () => LoadResult;
}
export interface WakeLadderAction {
    qitemId: string;
    action: "retry" | "escalate-orchestrator" | "escalate-operator" | "suspend" | "resume" | "exhaust" | "park-usage-limit";
    target?: string;
}
export interface WakeLadderTickResult {
    outcome: "clean" | "actions" | "failed";
    actions: WakeLadderAction[];
    error?: string;
}
/** Another consumer may diagnose the same parked seat, but the existing
 * delivery ladder/disposition already owns these obligations' next wake.
 * Diagnosis remains visible; only duplicate delivery is suppressed. */
export declare function queueRecoveryOwnsWake(db: Database.Database, row: QueueItem | null): boolean;
/** Read the existing ladder's next eligible action; never create an intent,
 * reserve a retry, consume provider state or change its policy. The scheduler
 * still makes the final live-state decision at delivery time. */
export declare function readWakeLadderBackstop(db: Database.Database, qitemId: string): WaitingView["nextBackstop"] | null;
/**
 * One ladder tick. Everything is derived from the row + transition log — the tick holds
 * no memory (F6). Never throws: a tick that cannot run is loud on the status surface
 * and the log, because a silent skip is the exact class this slice kills.
 */
export declare function runWakeLadderTick(deps: WakeLadderDeps): Promise<WakeLadderTickResult>;
/** An old idle observation cannot clear a newly observed transport refusal.
 * Keep uncertainty until the existing oracle supplies a newer clear state: needs-input
 * evidence observed after the refusal. A declared rung that never reported, or a newer
 * working/idle update on top of an older clear, is not that evidence. */
export declare function classifyPromptAfterRefusal(state: Pick<ArbitratedSeatState, "activity" | "needsInput" | "needsInputEvidence"> | null | undefined, refusedAt: string): "blocked" | "clear" | "unknown";
/** The production prompt read for a refused destination. The activity oracle answers first; when it has no
 *  evidence, the ladder reads the same retained runtime hook the send gate refused on, so a held wake still
 *  escalates after the activity service is rebuilt, or when the oracle does not yet trust the hook source
 *  (Codex's). A generation-valid hook observed after the refusal that means work started, the turn ended,
 *  or a Codex permission prompt cleared answers "clear", as does the oracle; anything else stays "unknown". */
export declare function makePromptStateReader(deps: {
    db: Database.Database;
    getSeatState?: (nodeId: string) => Pick<ArbitratedSeatState, "activity" | "needsInput" | "needsInputEvidence"> | null | undefined;
    getLatestHook?: (sessionName: string) => AgentActivity | null | undefined;
}): (destination: string, refusedAt: string) => "blocked" | "clear" | "unknown";
export interface WakeLadderSchedulerDeps {
    runTick: () => Promise<WakeLadderTickResult>;
    tickIntervalMs?: number;
    setTimer?: (cb: () => void, ms: number) => NodeJS.Timeout;
    clearTimer?: (handle: NodeJS.Timeout) => void;
    onTickError?: (err: unknown) => void;
}
/** The standing loop — the watchdog-scheduler pattern (injected seams, runTickNow, no
 *  overlapping ticks), so the ladder is unit-drivable without timers. */
export declare class WakeLadderScheduler {
    private readonly deps;
    private timer;
    private inflight;
    private shuttingDown;
    private started;
    constructor(deps: WakeLadderSchedulerDeps);
    start(): void;
    stop(): Promise<void>;
    runTickNow(): Promise<void>;
    private scheduleNext;
}
//# sourceMappingURL=queue-wake-ladder.d.ts.map