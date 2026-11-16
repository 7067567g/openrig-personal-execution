import { createHash } from "node:crypto";
import { parse as parseYaml } from "yaml";
import { artifactPoolReadyPolicy } from "./policies/artifact-pool-ready.js";
import { edgeArtifactRequiredPolicy } from "./policies/edge-artifact-required.js";
import { periodicReminderPolicy } from "./policies/periodic-reminder.js";
import { contextUsageThresholdPolicy } from "./policies/context-usage-threshold.js";
import { WatchdogJobsError, } from "./watchdog-jobs-repository.js";
export function formatWatchdogDeliveryMessage(source, message) {
    return `[OpenRig watchdog scheduler · policy: ${source.policy} · job: ${source.jobId}]\n${message}`;
}
const PHASE_C_BUILTIN_POLICIES = [
    periodicReminderPolicy,
    artifactPoolReadyPolicy,
    edgeArtifactRequiredPolicy,
    contextUsageThresholdPolicy,
];
/**
 * Quiet skip reasons — POC `shouldAppendHistory` (engine.mjs:99-112)
 * suppresses these from history. Same set must NOT emit watchdog.*
 * events for parity with POC SSE behavior; agents never see scheduler
 * polls just because the pool was empty or the wake throttle was active.
 */
const QUIET_SKIP_REASONS = new Set([
    "not_due",
    "queue_wait_already_presented",
    "queue_wait_owner_working",
    "workflow_healthy_deadline_gated",
    "workflow_recovery_owns_notice",
    "workflow_deadline_already_presented",
    "no_actionable_artifacts",
    "no_missing_edge_artifacts",
    "active_wake_not_due",
    "context_usage_below_threshold",
    "threshold_receipt_stable",
    // OPR.0.4.3.16 idle-gate-qitem routine no-ops — analogues of
    // no_actionable_artifacts. Suppressed from history/SSE so a per-second
    // scan does not spam when there is simply nothing to wake about. The
    // audited signal is the WAKE (fired) path.
    "no_pending_gate",
    "seat_active",
    // OPR.0.5.8.1 S2 — the gated condition has not materially changed since the
    // wake that was already delivered for it. Quiet for the same reason as its
    // siblings: a 60s scan must not write a history row every minute. The
    // suppression stays derivable without one — the row itself remains visible in
    // the held/escalations views (this suppresses the WAKE, never the record),
    // and the job carries `last_fired_condition`, the exact condition it fired
    // for. Adding this string changes no throttle semantics and no other policy
    // emits it.
    "gate_condition_unchanged",
    // OPR.0.5.6.24 — the parked-owner consumer's clean-scan no-op: nothing
    // parked, nothing closed, nothing deferred. Suppressed so a routine rig
    // scan writes no history (the loud, audited signals are the SENT wake,
    // episode-ended, and all-parked-owners-deferred).
    "no-parked-owner",
    // OPR.0.4.3.16 rev1-r1 fixback (advisor ruling 2026-07-03): seat_needs_input
    // and activity_stale_unknown are the COMMON recurring states for this
    // policy's own target scenario — a gate qitem pending on a seat that has
    // gone stale/needs-input. Such a seat never becomes fresh-idle, so it never
    // hits the send throttle; left LOUD it emitted one history row + one SSE per
    // scan, UNBOUNDED, for as long as the gate stayed pending — contradicting the
    // slice's bounded/no-spam ACs (BR6/AC2). Quiet here suppresses the per-scan
    // history+SSE for these routine unwakeable states while the WAKE (send) path
    // — the signal operators actually need — stays LOUD/audited. Stuck-seat
    // visibility is served on-demand (pending gate qitems mapped to unwakeable
    // seats), NOT via a per-scan log.
    "seat_needs_input",
    "activity_stale_unknown",
]);
export class WatchdogPolicyEngine {
    jobsRepo;
    historyLog;
    eventBus;
    deliver;
    parseSpec;
    now;
    policies;
    resolveTargetGeneration;
    resolvePreDeliveryTerminalReason;
    resolveQueueWait;
    onWakeAttempt;
    constructor(deps) {
        this.jobsRepo = deps.jobsRepo;
        this.historyLog = deps.historyLog;
        this.eventBus = deps.eventBus;
        this.deliver = deps.deliver;
        this.resolveTargetGeneration = deps.resolveTargetGeneration;
        this.resolvePreDeliveryTerminalReason = deps.resolvePreDeliveryTerminalReason;
        this.onWakeAttempt = deps.onWakeAttempt;
        this.resolveQueueWait = deps.resolveQueueWait;
        this.parseSpec = deps.parseSpec ?? parseWatchdogSpec;
        this.now = deps.now ?? (() => new Date());
        this.policies = new Map();
        for (const p of PHASE_C_BUILTIN_POLICIES)
            this.policies.set(p.name, p);
        if (deps.additionalPolicies) {
            for (const p of deps.additionalPolicies)
                this.policies.set(p.name, p);
        }
    }
    resolvePolicy(name) {
        return this.policies.get(name);
    }
    inactiveJobResult(jobId) {
        const job = this.jobsRepo.getByIdOrThrow(jobId);
        if (job.state === "active")
            return null;
        return {
            job,
            outcome: { action: "skip", reason: "job_not_active" },
            history: null,
            delivery: null,
            meaningful: false,
        };
    }
    async evaluate(job, evaluationPassStartedAt) {
        // A prior job's delivery may have yielded since the scheduler selected this row.
        const inactive = this.inactiveJobResult(job.jobId);
        if (inactive)
            return inactive;
        const policy = this.resolvePolicy(job.policy);
        const evaluatedAt = this.now().toISOString();
        const receiptCutoffAt = evaluationPassStartedAt ?? evaluatedAt;
        if (!policy) {
            const reason = `unknown_policy:${job.policy}`;
            this.jobsRepo.markTerminal(job.jobId, reason);
            const history = this.historyLog.record({
                jobId: job.jobId,
                evaluatedAt,
                outcome: "terminal",
                skipReason: reason,
            });
            this.eventBus.emit({
                type: "watchdog.evaluation_terminal",
                jobId: job.jobId,
                policy: job.policy,
                terminalReason: reason,
            });
            return {
                job: this.jobsRepo.getByIdOrThrow(job.jobId),
                outcome: { action: "terminal", reason },
                history,
                delivery: null,
                meaningful: true,
            };
        }
        const parsed = this.parseSpec(job.specYaml);
        const isContextUsageThreshold = job.policy === "context-usage-threshold";
        const target = isContextUsageThreshold
            ? { session: job.targetSession }
            : (parsed.target ?? { session: job.targetSession });
        const occupantGeneration = isContextUsageThreshold
            ? (this.resolveTargetGeneration?.(job.targetSession) ?? null)
            : null;
        let watchedFilePath = job.watchedFilePath;
        let currentGenerationTranscriptPending = false;
        if (isContextUsageThreshold &&
            occupantGeneration &&
            job.watchedFileGeneration !== occupantGeneration) {
            watchedFilePath = this.jobsRepo.findTranscriptPath(job.targetSession, occupantGeneration);
            if (watchedFilePath) {
                this.jobsRepo.recordWatchedFileBinding(job.jobId, watchedFilePath, occupantGeneration);
                this.historyLog.record({
                    jobId: job.jobId,
                    evaluatedAt,
                    outcome: "skipped",
                    skipReason: "watched_file_bound",
                    evaluationNotes: {
                        boundAt: evaluatedAt,
                        occupantGeneration,
                        watchedFilePath,
                    },
                });
            }
            else {
                currentGenerationTranscriptPending = true;
            }
        }
        const requiredJob = job.requiresJobId ? this.jobsRepo.getById(job.requiresJobId) : null;
        const requiredReceiptGenerationMatched = occupantGeneration !== null &&
            requiredJob?.lastFiredGeneration === occupantGeneration;
        const requiredFireMs = Date.parse(requiredJob?.lastFireAt ?? "");
        const receiptCutoffMs = Date.parse(receiptCutoffAt);
        const receiptPredatesBoundary = evaluationPassStartedAt === undefined
            ? requiredFireMs <= receiptCutoffMs
            : requiredFireMs < receiptCutoffMs;
        const requiredReceiptSatisfied = !job.requiresJobId || (requiredReceiptGenerationMatched &&
            Number.isFinite(requiredFireMs) &&
            Number.isFinite(receiptCutoffMs) &&
            receiptPredatesBoundary);
        const requiredReceiptDeferred = Boolean(job.requiresJobId &&
            requiredReceiptGenerationMatched &&
            Number.isFinite(requiredFireMs) &&
            Number.isFinite(receiptCutoffMs) &&
            !receiptPredatesBoundary);
        const policyJob = {
            jobId: job.jobId,
            policy: job.policy,
            target,
            message: parsed.message ?? undefined,
            intervalSeconds: job.intervalSeconds,
            activeWakeIntervalSeconds: job.activeWakeIntervalSeconds,
            scanIntervalSeconds: job.scanIntervalSeconds,
            context: parsed.context,
            lastEvaluationAt: job.lastEvaluationAt,
            lastFireAt: job.lastFireAt,
            registeredBySession: job.registeredBySession,
            registeredAt: job.registeredAt,
            watchedFilePath,
            thresholdBytes: job.thresholdBytes,
            requiresJobId: job.requiresJobId,
            lastFiredGeneration: job.lastFiredGeneration,
            occupantGeneration,
            currentGenerationTranscriptPending,
            requiredReceiptSatisfied,
            requiredReceiptDeferred,
        };
        const outcome = this.resolveQueueWait?.({ jobId: job.jobId }) ?? await policy.evaluate(policyJob);
        // Stop, park completion or seat handover may retire the job while its policy awaits I/O.
        // Discard every outcome before it can deliver or overwrite the retirement's state.
        const retired = this.inactiveJobResult(job.jobId);
        if (retired)
            return retired;
        if (outcome.action === "skip") {
            // POC parity: skip clears actionable. Loud-vs-quiet decides
            // whether to record + emit.
            this.jobsRepo.recordEvaluation(job.jobId, evaluatedAt, false);
            this.jobsRepo.setActionable(job.jobId, false, evaluatedAt);
            const isQuiet = QUIET_SKIP_REASONS.has(outcome.reason);
            if (isQuiet) {
                return {
                    job: this.jobsRepo.getByIdOrThrow(job.jobId),
                    outcome,
                    history: null,
                    delivery: null,
                    meaningful: false,
                };
            }
            const history = this.historyLog.record({
                jobId: job.jobId,
                evaluatedAt,
                outcome: "skipped",
                skipReason: outcome.reason,
                evaluationNotes: outcome.notes ?? null,
            });
            this.eventBus.emit({
                type: "watchdog.evaluation_skipped",
                jobId: job.jobId,
                policy: job.policy,
                skipReason: outcome.reason,
            });
            return {
                job: this.jobsRepo.getByIdOrThrow(job.jobId),
                outcome,
                history,
                delivery: null,
                meaningful: true,
            };
        }
        if (outcome.action === "terminal") {
            this.jobsRepo.markTerminal(job.jobId, outcome.reason);
            const history = this.historyLog.record({
                jobId: job.jobId,
                evaluatedAt,
                outcome: "terminal",
                skipReason: outcome.reason,
                evaluationNotes: outcome.notes ?? null,
            });
            this.eventBus.emit({
                type: "watchdog.evaluation_terminal",
                jobId: job.jobId,
                policy: job.policy,
                terminalReason: outcome.reason,
            });
            return {
                job: this.jobsRepo.getByIdOrThrow(job.jobId),
                outcome,
                history,
                delivery: null,
                meaningful: true,
            };
        }
        // outcome.action === "send".
        // POC active-wake throttle (engine.mjs:49-64, :243-263):
        //   - If state.actionable was already true AND active_wake_interval
        //     is set AND wake-window has not elapsed → quiet skip. Preserves
        //     existing last_fire_at and last_actionable_at.
        //   - Otherwise: deliver, set actionable=true, stamp last_fire_at +
        //     last_actionable_at (preserve existing first-actionable timestamp).
        if (job.actionable &&
            job.activeWakeIntervalSeconds !== null &&
            job.lastFireAt !== null) {
            const lastFireMs = Date.parse(job.lastFireAt);
            const nowMs = Date.parse(evaluatedAt);
            const intervalMs = job.activeWakeIntervalSeconds * 1000;
            if (Number.isFinite(lastFireMs) && nowMs - lastFireMs < intervalMs) {
                // Quiet skip: scan happened, pool still actionable, but the
                // wake window is closed. Update last_evaluation_at, do NOT
                // touch last_fire_at, keep actionable=true and preserve
                // last_actionable_at.
                this.jobsRepo.recordEvaluation(job.jobId, evaluatedAt, false);
                this.jobsRepo.setActionable(job.jobId, true, evaluatedAt, job.lastActionableAt);
                return {
                    job: this.jobsRepo.getByIdOrThrow(job.jobId),
                    outcome: { action: "skip", reason: "active_wake_not_due" },
                    history: null,
                    delivery: null,
                    meaningful: false,
                };
            }
        }
        // (i-c) FIRE-TIME target-generation gate. A generation-bound wake (job.targetGeneration set) must
        // not fire at a target handed over to a DIFFERENT live generation since it was armed. Role-bound
        // jobs (null) skip the gate → fire unchanged. UNKNOWN live generation (null) fails OPEN → deliver
        // (the protective act is SKIPPING, so unknown never skips — note-2). Only a resolved MISMATCH
        // skips LOUD (loud reason → recorded + emitted), with a structured audit naming BOTH generations.
        if (job.targetGeneration !== null && this.resolveTargetGeneration) {
            const liveGeneration = this.resolveTargetGeneration(outcome.target.session);
            if (liveGeneration !== null && liveGeneration !== job.targetGeneration) {
                const reason = "target_generation_mismatch";
                this.jobsRepo.recordEvaluation(job.jobId, evaluatedAt, false);
                this.jobsRepo.setActionable(job.jobId, false, evaluatedAt);
                const history = this.historyLog.record({
                    jobId: job.jobId,
                    evaluatedAt,
                    outcome: "skipped",
                    skipReason: reason,
                    evaluationNotes: {
                        armedForGeneration: job.targetGeneration,
                        liveGeneration,
                        targetSession: outcome.target.session,
                    },
                });
                this.eventBus.emit({
                    type: "watchdog.evaluation_skipped",
                    jobId: job.jobId,
                    policy: job.policy,
                    skipReason: reason,
                });
                return {
                    job: this.jobsRepo.getByIdOrThrow(job.jobId),
                    outcome: { action: "skip", reason },
                    history,
                    delivery: null,
                    meaningful: true,
                };
            }
        }
        // OPR.0.5.8.1 S1c — current queue transitions retire park timers at every
        // exit. This narrow pre-transport guard handles only legacy persisted
        // residue, where the row is already terminal and no transition remains to
        // intercept. It runs after normal policy/throttle/generation decisions but
        // before any custody or message delivery side effect.
        const preDeliveryTerminalReason = this.resolvePreDeliveryTerminalReason?.({ jobId: job.jobId });
        if (preDeliveryTerminalReason) {
            this.jobsRepo.markTerminal(job.jobId, preDeliveryTerminalReason);
            const history = this.historyLog.record({
                jobId: job.jobId,
                evaluatedAt,
                outcome: "terminal",
                skipReason: preDeliveryTerminalReason,
            });
            this.eventBus.emit({
                type: "watchdog.evaluation_terminal",
                jobId: job.jobId,
                policy: job.policy,
                terminalReason: preDeliveryTerminalReason,
            });
            return {
                job: this.jobsRepo.getByIdOrThrow(job.jobId),
                outcome: { action: "terminal", reason: preDeliveryTerminalReason },
                history,
                delivery: null,
                meaningful: true,
            };
        }
        const continuityAction = parseContinuityAction(parsed.context["continuity_action"], job, occupantGeneration);
        // Plain wakes retain the proven at-most-once ordering. Structured
        // continuity custody is retry-safe by deterministic qitem id, so its
        // receipt waits until the durable action has completed.
        if (isContextUsageThreshold && occupantGeneration && !continuityAction) {
            this.jobsRepo.recordThresholdFire(job.jobId, occupantGeneration, evaluatedAt);
        }
        const deliverySchedule = this.jobsRepo.getByIdOrThrow(job.jobId);
        const delivery = await this.deliver({
            targetSession: outcome.target.session,
            message: outcome.message,
            ...(continuityAction ? { continuityAction } : {}),
        }, { jobId: job.jobId, policy: job.policy, occurrenceId: createHash("sha256").update(JSON.stringify([job.jobId, occupantGeneration, outcome.conditionReceipt ?? (job.policy === "periodic-reminder" ? job.lastFireAt : outcome.message)])).digest("hex") });
        if (isContextUsageThreshold &&
            occupantGeneration &&
            continuityAction &&
            delivery.continuityActionCompleted === true) {
            this.jobsRepo.recordThresholdFire(job.jobId, occupantGeneration, evaluatedAt);
        }
        const history = this.historyLog.record({
            jobId: job.jobId,
            evaluatedAt,
            outcome: delivery.status === "retained" ? "skipped" : "sent",
            skipReason: delivery.status === "retained" ? "typing_guard_retained" : null,
            deliveryTargetSession: outcome.target.session,
            deliveryStatus: delivery.status,
            deliveryMessage: outcome.message,
            // OPR.0.5.6.24 — the delivery error/reason string survives into the
            // durable record so a policy can distinguish an interactive-prompt
            // refusal from a generic failure (status alone discards that identity).
            evaluationNotes: delivery.error !== undefined
                ? { ...(outcome.notes ?? {}), deliveryReason: delivery.error }
                : delivery.status === "retained" ? { ...(outcome.notes ?? {}), outboxIds: delivery.outboxIds ?? [], retainedNotDelivered: true } : outcome.notes ?? null,
        });
        if (!isContextUsageThreshold) {
            this.jobsRepo.recordEvaluation(job.jobId, evaluatedAt, true, deliverySchedule);
        }
        // OPR.0.5.8.1 S2 — a policy's condition receipt is banked ONLY on positive
        // delivery. `status` is "ok" | "failed"; anything that is not a definite ok
        // leaves the receipt untouched so the next scan retries. A policy that does
        // not propose a receipt is untouched by this, so no other policy's
        // behaviour changes.
        if (outcome.conditionReceipt !== undefined && delivery.status === "ok") {
            this.jobsRepo.recordConditionReceipt(job.jobId, outcome.conditionReceipt);
        }
        this.jobsRepo.setActionable(job.jobId, true, evaluatedAt, job.lastActionableAt);
        this.eventBus.emit({
            type: "watchdog.evaluation_fired",
            jobId: job.jobId,
            policy: job.policy,
            targetSession: outcome.target.session,
            deliveryStatus: delivery.status,
        });
        // The history above audits the actual attempt. A newer park/blocker change
        // must not receive its receipt or be backed off as though we sent for it.
        const current = this.jobsRepo.getByIdOrThrow(job.jobId);
        if (current.state === "active" && current.specYaml === deliverySchedule.specYaml
            && current.intervalSeconds === deliverySchedule.intervalSeconds
            && (isContextUsageThreshold || current.lastEvaluationAt === evaluatedAt)) {
            this.onWakeAttempt?.({ jobId: job.jobId, deliveryStatus: delivery.status });
        }
        return {
            job: this.jobsRepo.getByIdOrThrow(job.jobId),
            outcome,
            history,
            delivery,
            meaningful: true,
        };
    }
}
function parseContinuityAction(raw, job, occupantGeneration) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return undefined;
    const value = raw;
    if (value["type"] !== "create-cutover-baton")
        return undefined;
    if (!occupantGeneration ||
        typeof value["destination"] !== "string" ||
        typeof value["body"] !== "string") {
        throw new Error(`continuity_action_invalid: ${job.jobId}`);
    }
    return {
        type: "create-cutover-baton",
        jobId: job.jobId,
        occupantGeneration,
        sourceSession: job.targetSession,
        destination: value["destination"],
        body: value["body"],
    };
}
/** Parse the operator-authored watchdog YAML before it reaches persistence. */
export function parseWatchdogSpec(specYaml) {
    let parsed;
    try {
        parsed = parseYaml(specYaml);
    }
    catch (err) {
        throw new WatchdogJobsError("spec_invalid", `watchdog spec has invalid YAML: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!isRecord(parsed)) {
        throw new WatchdogJobsError("spec_invalid", "watchdog spec must be a YAML mapping");
    }
    const rawMessage = parsed["message"];
    if (rawMessage !== undefined && rawMessage !== null && typeof rawMessage !== "string") {
        throw new WatchdogJobsError("spec_invalid", "watchdog spec field 'message' must be a string");
    }
    const rawContext = parsed["context"];
    if (rawContext !== undefined && rawContext !== null && !isRecord(rawContext)) {
        throw new WatchdogJobsError("spec_invalid", "watchdog spec field 'context' must be a mapping");
    }
    const context = isRecord(rawContext) ? rawContext : {};
    if (context["message"] !== undefined &&
        context["message"] !== null &&
        typeof context["message"] !== "string") {
        throw new WatchdogJobsError("spec_invalid", "watchdog spec field 'context.message' must be a string");
    }
    const rawTarget = parsed["target"];
    let target = null;
    if (typeof rawTarget === "string") {
        target = { session: rawTarget };
    }
    else if (rawTarget !== undefined && rawTarget !== null) {
        if (!isRecord(rawTarget) || typeof rawTarget["session"] !== "string") {
            throw new WatchdogJobsError("spec_invalid", "watchdog spec field 'target' must be a session string or mapping with string 'session'");
        }
        target = { session: rawTarget["session"] };
    }
    return {
        target,
        message: typeof rawMessage === "string" ? rawMessage : null,
        context,
    };
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=watchdog-policy-engine.js.map