import type { QueueRepository } from "./queue-repository.js";
import type { WatchdogJobsRepository } from "./watchdog-jobs-repository.js";
import type { WorkflowInstanceStore } from "./workflow-instance-store.js";
import type { EnsureStuckExceptionItem } from "./workflow-exception-escalation.js";
export interface WorkflowBootSweepResult {
    instancesSwept: number;
    keepalivesArmed: number;
    lostNudgesReissued: number;
    stuckSurfaced: number;
    /** OPR.0.4.6.WF5 FR-2 class (b): stuck exception items created this
     *  sweep (deduped re-detections not counted). */
    exceptionItemsCreated: number;
}
export interface WorkflowBootSweepDeps {
    instanceStore: WorkflowInstanceStore;
    queueRepo: QueueRepository;
    watchdogJobsRepo: WatchdogJobsRepository;
    log?: (line: string) => void;
    now?: () => Date;
    /** OPR.0.4.6.WF5 FR-2 class (b): when supplied, a non-healthy deadline
     *  verdict ENSURES the durable exception item at detection time (the
     *  crash-surviving never-lost leg — re-detection re-creates a missed
     *  item). Optional so pre-WF-5 embedders keep working; startup wires
     *  the real closure. Failures are non-fatal to the sweep. */
    ensureStuckExceptionItem?: EnsureStuckExceptionItem;
    reconcileStuckExceptions?: () => number;
}
export declare function runWorkflowBootSweep(deps: WorkflowBootSweepDeps): Promise<WorkflowBootSweepResult>;
//# sourceMappingURL=workflow-boot-sweep.d.ts.map