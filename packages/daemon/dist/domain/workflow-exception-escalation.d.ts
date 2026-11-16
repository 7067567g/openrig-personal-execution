import type Database from "better-sqlite3";
import { type QueueRepository } from "./queue-repository.js";
import type { WorkflowDeadlineVerdict } from "./workflow-deadline.js";
import { type WorkflowExceptionClass } from "./workflow-exception.js";
import type { ExceptionRoute } from "./workflow-exception-router.js";
import { type WorkflowHumanDestination } from "./workflow-human-destination.js";
export interface EnsureStuckExceptionInput {
    workflowName: string;
    workflowVersion: string;
    /** The session recorded as the item's source (the instance creator —
     *  a real, validated session; the detector is machinery, not a seat). */
    createdBySession: string;
    verdict: WorkflowDeadlineVerdict;
}
export interface EnsureStuckExceptionResult {
    outcome: "skipped-healthy" | "deduped" | "created";
    qitemId?: string;
}
export type EnsureStuckExceptionItem = (input: EnsureStuckExceptionInput) => Promise<EnsureStuckExceptionResult>;
export interface StuckExceptionDeps {
    db: Database.Database;
    queueRepo: QueueRepository;
    /** The maturity-dial resolution for a cached spec (runtime-owned —
     *  spec lookup + the shipped role resolution live there). null =
     *  spec not cached; registered-human selection applies.
     *  OPR.0.4.6.FAC1 (arch Q3): boundRig = the stuck instance's bound
     *  rig (read from workflow_instances at detection time) so the
     *  orchestrator-role dial position resolves capability-aware. */
    resolveRoute: (workflowName: string, workflowVersion: string, exceptionClass: WorkflowExceptionClass, boundRig?: string | null) => ExceptionRoute | null;
    humanFallbackSeat?: WorkflowHumanDestination;
    log?: (line: string) => void;
}
export declare function makeEnsureStuckExceptionItem(deps: StuckExceptionDeps): EnsureStuckExceptionItem;
//# sourceMappingURL=workflow-exception-escalation.d.ts.map