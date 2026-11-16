import type Database from "better-sqlite3";
/**
 * OPR.0.4.6.WF3 FR-6 — the frontier close-path guard's PREDICATE (pm
 * convention ruling: prevention over detection).
 *
 * THE LAYERING PIN (arch, binding, Rev-1): the queue is the lower
 * primitive and NEVER imports the workflow domain. This module is the
 * workflow domain's export; startup INJECTS the predicate into
 * QueueRepository (the `validateRig` injection precedent exactly).
 * Same functional behavior as a direct import, without the module
 * cycle the next refactor would strangle on.
 *
 * The predicate answers: is this qitem a LIVE workflow-frontier
 * packet? Null for every non-workflow qitem — the zero-friction
 * negative (non-workflow closure behavior stays byte-identical; no
 * new rejections ride this predicate for ordinary traffic).
 */
export interface WorkflowFrontierBinding {
    instanceId: string;
    workflowName: string;
}
export type WorkflowFrontierPredicate = (qitemId: string) => WorkflowFrontierBinding | null;
export declare function createWorkflowFrontierPredicate(db: Database.Database): WorkflowFrontierPredicate;
//# sourceMappingURL=workflow-frontier-guard.d.ts.map