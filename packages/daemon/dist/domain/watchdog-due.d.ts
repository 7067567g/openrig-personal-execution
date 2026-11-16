import type { WatchdogJob } from "./watchdog-jobs-repository.js";
/**
 * Upgrade bridge (#860): builds predating the first-interval rule marked a
 * pending wake by writing a null lastEvaluationAt. Fresh arms always start
 * with eventPending false (and record an evaluation at registration), so a
 * null evaluation plus a pending event can only be pre-upgrade state — and
 * stays immediately due instead of waiting out a fresh first interval.
 */
export declare function isQueueWaitEventPending(specYaml: string): boolean;
/**
 * When the scheduler next evaluates a job, in epoch milliseconds, or null
 * when it is due now. The scheduler's `isDue` and the waiting view's
 * projected wake both read it, so the projection can't drift from the
 * schedule. It has no domain imports, so either can use it.
 */
export declare function nextDueAt(job: Pick<WatchdogJob, "policy" | "specYaml" | "registeredAt" | "intervalSeconds" | "scanIntervalSeconds" | "lastEvaluationAt">): number | null;
//# sourceMappingURL=watchdog-due.d.ts.map