import type { EventBus } from "./event-bus.js";
import type { Policy, PolicyEvaluation } from "./policies/types.js";
import { type WatchdogJob, type WatchdogJobsRepository } from "./watchdog-jobs-repository.js";
import type { WatchdogHistoryEntry, WatchdogHistoryLog } from "./watchdog-history-log.js";
/**
 * Watchdog policy engine (PL-004 Phase C R1).
 *
 * Owns the per-evaluation state machine that mirrors POC engine
 * `lib/engine.mjs`:
 *   1. Resolve policy by name from registry. Unknown policy → terminal.
 *   2. Parse spec_yaml into top-level `target:` + top-level `message?:` +
 *      nested `context:` block, then build a PolicyJob with the
 *      resolved target object (falls back to registered targetSession
 *      when spec lacks an explicit `target:`).
 *   3. Dispatch policy.evaluate(policyJob).
 *   4. Action handling:
 *      - skip: clear actionable=false; record history + emit event
 *        ONLY if reason is "loud" (not in QUIET_SKIP_REASONS).
 *      - send: enforce active-wake throttle. If state.actionable was
 *        already true AND active_wake_interval_seconds is set AND not
 *        elapsed since last_fire_at → emit/record `active_wake_not_due`
 *        (quiet skip per POC). Otherwise call delivery, record history
 *        with sent outcome, emit evaluation_fired, set actionable=true.
 *      - terminal: mark job terminal, record history, emit terminal.
 *
 * `not_due` polls are filtered upstream by the scheduler and never
 * reach this engine.
 */
export interface DeliveryRequest {
    targetSession: string;
    message: string;
    continuityAction?: {
        type: "create-cutover-baton";
        jobId: string;
        occupantGeneration: string;
        sourceSession: string;
        destination: string;
        body: string;
    };
}
export interface DeliveryOutcome {
    status: "ok" | "failed" | "retained";
    outboxIds?: string[];
    error?: string;
    /** Structured continuity custody was durably created or identified. */
    continuityActionCompleted?: boolean;
}
export interface WatchdogDeliverySource {
    occurrenceId?: string;
    jobId: string;
    policy: string;
}
export type DeliveryFn = (req: DeliveryRequest, source: WatchdogDeliverySource) => Promise<DeliveryOutcome>;
export declare function formatWatchdogDeliveryMessage(source: WatchdogDeliverySource, message: string): string;
export interface PolicyContextParser {
    /**
     * Parse the operator-supplied spec_yaml into the structured fields the
     * engine needs. Returns the top-level `target` (object), top-level
     * `message` (string), and the `context:` block (Record).
     */
    (specYaml: string): {
        target: {
            session: string;
        } | null;
        message: string | null;
        context: Record<string, unknown>;
    };
}
interface WatchdogPolicyEngineDeps {
    jobsRepo: WatchdogJobsRepository;
    historyLog: WatchdogHistoryLog;
    eventBus: EventBus;
    deliver: DeliveryFn;
    parseSpec?: PolicyContextParser;
    now?: () => Date;
    /**
     * PL-004 Phase D extension point (orch-ratified per slice IMPL):
     * additional policies to register alongside the Phase C built-in
     * three. Used to register `workflow-keepalive` (which depends on
     * the Phase D workflow_instances DB and so must be constructed at
     * daemon startup with a db handle injected).
     */
    additionalPolicies?: Policy[];
    /**
     * (i-c) FIRE-TIME target-generation gate. Resolve a target session's LIVE occupant-generation (P12
     * `occupant_tenures`) so a GENERATION-bound wake (job.targetGeneration set) can be refused when the
     * target has been handed over to a different generation since the job was armed. Absent → gate off
     * (jobs fire unchanged). A null return = UNKNOWN → fail-open (deliver): the protective act is
     * SKIPPING, so an unknown target-generation must never skip a legitimate wake (note-2 inversion).
     */
    resolveTargetGeneration?: (sessionName: string) => string | null;
    /** Last defense before transport for persisted jobs whose owning domain can
     *  prove they are no longer actionable. A reason terminals the job without
     *  delivering; null preserves the existing send path. */
    resolvePreDeliveryTerminalReason?: (input: {
        jobId: string;
    }) => string | null;
    /** Queue-side observer for a wake attempt. It appends resume evidence to
     *  every HELD row armed to this job; delivery outcome is preserved. */
    resolveQueueWait?: (input: {
        jobId: string;
    }) => PolicyEvaluation | null | undefined;
    onWakeAttempt?: (attempt: {
        jobId: string;
        deliveryStatus: string;
    }) => void;
}
export interface EvaluationResult {
    job: WatchdogJob;
    outcome: PolicyEvaluation | {
        action: "skip";
        reason: "active_wake_not_due";
    };
    history: WatchdogHistoryEntry | null;
    delivery: DeliveryOutcome | null;
    /** True if this evaluation produced a history record + event. */
    meaningful: boolean;
}
export declare class WatchdogPolicyEngine {
    private readonly jobsRepo;
    private readonly historyLog;
    private readonly eventBus;
    private readonly deliver;
    private readonly parseSpec;
    private readonly now;
    private readonly policies;
    private readonly resolveTargetGeneration?;
    private readonly resolvePreDeliveryTerminalReason?;
    private readonly resolveQueueWait?;
    private readonly onWakeAttempt?;
    constructor(deps: WatchdogPolicyEngineDeps);
    resolvePolicy(name: string): Policy | undefined;
    private inactiveJobResult;
    evaluate(job: WatchdogJob, evaluationPassStartedAt?: string): Promise<EvaluationResult>;
}
/** Parse the operator-authored watchdog YAML before it reaches persistence. */
export declare function parseWatchdogSpec(specYaml: string): {
    target: {
        session: string;
    } | null;
    message: string | null;
    context: Record<string, unknown>;
};
export {};
//# sourceMappingURL=watchdog-policy-engine.d.ts.map