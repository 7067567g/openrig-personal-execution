import type Database from "better-sqlite3";
import { type WaitingView } from "./queue-waiting.js";
import type { PolicyEvaluation } from "./policies/types.js";
import type { WatchdogJob, WatchdogJobsRepository } from "./watchdog-jobs-repository.js";
interface WaitState {
    qitemId: string;
    blocker: string | null;
    blockerTransition: number | null;
    evidence: Record<string, unknown> | null;
    initialSeconds: number;
    maxSeconds: number;
    eventPending: boolean;
    attentionRevision?: string;
    notice?: {
        transition: number | null;
        attentionRevision?: string;
        at: string;
        deliveryStatus: string;
    };
}
export declare function isQueueWait(specYaml: string): boolean;
export declare function armQueueWait(db: Database.Database, jobs: WatchdogJobsRepository, input: {
    previousJobId?: string;
    qitemId: string;
    blocker: string | null;
    evidence?: Record<string, unknown>;
    initialSeconds: number;
    maxSeconds: number;
    message: string;
    owner: string;
    actor: string;
}): WatchdogJob;
/** Event-first schedule update; also run once on startup to bridge an interrupted
 * event delivery. Replays compare durable transition identity and write nothing. */
export declare function refreshQueueWaits(db: Database.Database, jobs: WatchdogJobsRepository, changedQitem?: string, proofChanged?: boolean): void;
/** Called after the existing watchdog delivers. Event wakes restart the initial
 * interval; unchanged timer wakes double it. The queue packet never changes. */
export declare function backOffQueueWait(jobs: WatchdogJobsRepository, jobId: string, deliveryStatus?: string): boolean;
/** One presentation per actual blocker transition. The existing stuck sweep owns
 * an unconsumed/failed notice after the pickup grace; the timer keeps reconciling
 * without replaying it or resetting that deadline. No receipt is task progress. */
export declare function evaluateQueueWait(jobs: WatchdogJobsRepository, jobId: string, view: WaitingView | null): PolicyEvaluation | null;
export declare function queueWaitNotice(specYaml: string): WaitState["notice"] | undefined;
/** Rebind the existing authored timer when custody moves to another worker.
 * Returning to the waiting owner is handled by auto-unpark instead. */
export declare function retargetQueueWait(db: Database.Database, jobs: WatchdogJobsRepository, jobId: string, blocker: string): boolean;
export {};
//# sourceMappingURL=queue-wait-backoff.d.ts.map