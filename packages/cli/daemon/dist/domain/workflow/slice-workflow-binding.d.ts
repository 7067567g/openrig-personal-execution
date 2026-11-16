import type Database from "better-sqlite3";
export interface SliceWorkflowBinding {
    /** The most recent workflow_instance touching the slice's qitem set. */
    instanceId: string;
    workflowName: string;
    workflowVersion: string;
    status: string;
    currentStepId: string | null;
    /** Frontier qitem_ids parsed from the JSON column. */
    currentFrontier: string[];
    hopCount: number;
    createdAt: string;
    completedAt: string | null;
}
export interface SliceWorkflowBindingResult {
    primary: SliceWorkflowBinding | null;
    /** Other instances touching the slice; surfaced for "+N more" UI. */
    additionalInstanceIds: string[];
}
export declare function findSliceWorkflowBinding(db: Database.Database, qitemIds: string[]): SliceWorkflowBindingResult;
//# sourceMappingURL=slice-workflow-binding.d.ts.map