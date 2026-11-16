import type Database from "better-sqlite3";
/**
 * Watchdog jobs repository (PL-004 Phase C; extended in Phase D).
 *
 * Owns all reads/writes against `watchdog_jobs`. Pure persistence; no
 * event-bus, no scheduler, no policy dispatch. Composed by the
 * scheduler and policy engine.
 *
 * Accepted policy values include the orch-ratified Phase C set plus
 * daemon-native workflow, idle-gate, and context-usage conditions:
 *   - periodic-reminder (Phase C)
 *   - artifact-pool-ready (Phase C)
 *   - edge-artifact-required (Phase C)
 *   - workflow-keepalive (Phase D)
 *   - idle-gate-qitem
 *   - context-usage-threshold
 *
 * PHASE_C_POLICIES retained as a deprecated alias for callers that
 * still reference it; new code uses PHASE_D_POLICIES.
 */
export declare const PHASE_D_POLICIES: readonly ["periodic-reminder", "artifact-pool-ready", "edge-artifact-required", "workflow-keepalive", "idle-gate-qitem", "context-usage-threshold", "parked-owner-consumer", "delivery-deferral", "delivery-digest-flush"];
/** @deprecated since Phase D — use PHASE_D_POLICIES. */
export declare const PHASE_C_POLICIES: readonly ["periodic-reminder", "artifact-pool-ready", "edge-artifact-required", "workflow-keepalive", "idle-gate-qitem", "context-usage-threshold", "parked-owner-consumer", "delivery-deferral", "delivery-digest-flush"];
export type WatchdogPolicyName = (typeof PHASE_D_POLICIES)[number];
export type WatchdogJobState = "active" | "stopped" | "terminal";
export interface WatchdogJob {
    jobId: string;
    policy: WatchdogPolicyName;
    specYaml: string;
    targetSession: string;
    intervalSeconds: number;
    activeWakeIntervalSeconds: number | null;
    scanIntervalSeconds: number | null;
    lastEvaluationAt: string | null;
    lastFireAt: string | null;
    actionable: boolean;
    lastActionableAt: string | null;
    state: WatchdogJobState;
    registeredBySession: string;
    registeredAt: string;
    terminalReason: string | null;
    /** (e/Class-B) atom-B generation of the occupant that armed this job; null = UNKNOWN/pre-063. */
    registeredByGeneration: string | null;
    /** (i-c) opt-in target occupant-generation this wake is bound to; null = ROLE-bound (fire at whoever
     *  occupies the seat name). Only a non-null value opts the job into the fire-time gen-gate. */
    targetGeneration: string | null;
    /** Transcript-byte condition state. Null on every other policy. */
    watchedFilePath: string | null;
    /** Occupant generation that qualified watchedFilePath. */
    watchedFileGeneration: string | null;
    /** Visible lifecycle of the generated transcript binding. */
    bindingState: "pending-binding" | "bound" | null;
    thresholdBytes: number | null;
    requiresJobId: string | null;
    /** The latest occupant generation for which this threshold fired. */
    lastFiredGeneration: string | null;
}
export interface RegisterWatchdogJobInput {
    policy: string;
    specYaml: string;
    targetSession: string;
    intervalSeconds: number;
    activeWakeIntervalSeconds?: number | null;
    scanIntervalSeconds?: number | null;
    registeredBySession: string;
    /** (i-c) opt-in: the occupant-generation this wake is bound to. Omit/null = ROLE-bound (the common
     *  case — fires at whoever occupies the seat, unchanged). Non-null opts into the fire-time gen-gate. */
    targetGenerationUuid?: string | null;
    watchedFilePath?: string | null;
    thresholdBytes?: number | null;
    requiresJobId?: string | null;
}
export type EnsureAutoRegistrationInput = RegisterWatchdogJobInput;
export declare class WatchdogJobsError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, details?: Record<string, unknown> | undefined);
}
export declare class WatchdogJobsRepository {
    private readonly db;
    private readonly now;
    private readonly resolveOccupantGeneration?;
    private readonly hasGenColumn;
    private readonly hasTargetGenColumn;
    private readonly hasContextUsageColumns;
    private readonly hasWatchedFileGenerationColumn;
    constructor(db: Database.Database, now?: () => Date, resolveOccupantGeneration?: ((sessionName: string) => string | null) | undefined);
    register(input: RegisterWatchdogJobInput): WatchdogJob;
    /** Transcript path sampled during the requested seat occupant generation. */
    findTranscriptPath(targetSession: string, occupantGeneration?: string | null): string | null;
    recordWatchedFileBinding(jobId: string, watchedFilePath: string, occupantGeneration: string): void;
    recordThresholdFire(jobId: string, occupantGeneration: string, firedAt: string): void;
    /**
     * Ensure the daemon-owned, role-bound auto-registration tuple has exactly
     * one nonterminal row. Stopped is an operator opt-out and is therefore as
     * durable as active; terminal-only history is replaced. The table has no
     * uniqueness constraint, so every matching row must be inspected.
     */
    ensureAutoRegistration(input: EnsureAutoRegistrationInput, historicalTargetSessions?: string[]): WatchdogJob;
    /**
     * Resolve the one active/stopped role-bound row across every historical
     * session alias for a node. Persisted states are intentionally closed:
     * unknown values are neither runnable jobs nor operator opt-outs.
     */
    findAutoRegistration(policy: string, targetSession: string, targetGenerationUuid: string | null, historicalTargetSessions?: string[]): WatchdogJob | null;
    /** All rows for the exact policy/seat/generation tuple, including history. */
    listExactTuple(policy: string, targetSession: string, targetGenerationUuid: string | null): WatchdogJob[];
    private listAliasTuples;
    getById(jobId: string): WatchdogJob | null;
    getByIdOrThrow(jobId: string): WatchdogJob;
    listAll(): WatchdogJob[];
    listActive(): WatchdogJob[];
    /** Record the evaluation and attempted fire. A delivery's schedule snapshot
     * advances the due boundary only while the active schedule still matches. */
    recordEvaluation(jobId: string, evaluatedAt: string, fired: boolean, schedule?: Pick<WatchdogJob, "specYaml" | "intervalSeconds" | "lastEvaluationAt">): void;
    /** Preserve job identity while its owner adjusts a durable reminder schedule. */
    updateSchedule(jobId: string, specYaml: string, intervalSeconds: number, lastEvaluationAt: string | null): void;
    /**
     * R1 fix: write the actionable-state machine columns. Mirrors POC
     * engine's `state.actionable` + `state.last_actionable_at`. Called
     * by the policy engine after every meaningful evaluation:
     *   - newActionable=false (skip): clears actionable + last_actionable_at.
     *   - newActionable=true with no preserveLastActionableAt: stamps
     *     last_actionable_at to evaluatedAt (newly actionable).
     *   - newActionable=true with preserveLastActionableAt set: keeps the
     *     existing first-actionable timestamp (continued actionable window).
     */
    setActionable(jobId: string, newActionable: boolean, evaluatedAt: string, preserveLastActionableAt?: string | null): void;
    /**
     * OPR.0.5.8.1 S2 — record the CONDITION a job last successfully woke about.
     *
     * Called by the engine only after a delivery that returned `ok`. A policy that
     * suppresses on "already told them" needs its receipt tied to evidence the
     * telling happened; recording it on the ATTEMPT turns one transport failure
     * into indefinite silence. One overwritten value per job, never appended to.
     */
    recordConditionReceipt(jobId: string, receipt: string): void;
    markTerminal(jobId: string, reason: string): void;
    stop(jobId: string, reason?: string): WatchdogJob;
    /**
     * GHOST-STAGE (e/Class-B): at a seat swap, stop every ARMED (state='active') job registered by the
     * RETIRING generation — a stale wake firing into the successor's context is the specimen; the
     * successor re-arms its own. Gen-scoped, NEVER name-scoped (the successor shares the seat name, so a
     * name-scoped stop would kill the successor's own jobs). A NULL/empty generation never matches
     * (UNKNOWN ≠ retired — note-2). Returns the count stopped. Auditable (terminal_reason), not a hard
     * delete — the row stays for forensics. Pre-063 dbs no-op. `keepJobIds` are left running: the queue's
     * current park timers wake the seat that owns a still-blocked row, which the successor inherits.
     */
    dropArmedByRegisteringGeneration(generationUuid: string, keepJobIds?: readonly string[]): number;
}
//# sourceMappingURL=watchdog-jobs-repository.d.ts.map