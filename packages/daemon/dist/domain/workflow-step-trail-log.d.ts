import type Database from "better-sqlite3";
import type { WorkflowExitKind, WorkflowStepTrailEntry } from "./workflow-types.js";
export interface WorkflowStepTrailRecordInput {
    instanceId: string;
    stepId: string;
    stepRole: string;
    closedAt: string;
    closureReason: WorkflowExitKind;
    closureEvidence?: Record<string, unknown> | null;
    actorSession: string;
    /** null for terminal closures (`done`, `failed`, `waiting`). */
    nextQitemId?: string | null;
    priorQitemId: string;
}
export declare class WorkflowStepTrailLog {
    private readonly db;
    constructor(db: Database.Database);
    /**
     * Append a step trail entry. Returns the persisted entry. Designed
     * to compose inside an outer caller-managed transaction (used by
     * workflow-projector for the transactional-scribe contract).
     */
    record(input: WorkflowStepTrailRecordInput): WorkflowStepTrailEntry;
    listForInstance(instanceId: string, limit?: number): WorkflowStepTrailEntry[];
    /**
     * Oldest first, in the order the rows were recorded. rowid follows
     * inserts in this append-only table, so the order holds even when
     * closed_at does not move forward.
     */
    listForInstanceInAppendOrder(instanceId: string): WorkflowStepTrailEntry[];
    countForInstance(instanceId: string): number;
}
//# sourceMappingURL=workflow-step-trail-log.d.ts.map