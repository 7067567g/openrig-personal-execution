import type Database from "better-sqlite3";
import type { WorkflowStepSpec } from "./workflow-types.js";
export interface LifecycleObligation {
    stepId: string;
    required: boolean;
    state: string;
    receiptState: "recorded" | "missing" | "not-required";
    receipt: {
        evidenceRef: string;
        actorSession: string;
        closedAt: string;
    } | null;
}
export declare function requiredLifecycleSteps(binding: Record<string, unknown> | null): string[];
/** One projection for workflow show and the execution view. Queue terminal state
 * never stands in for an agent's successful workflow closure and receipt. */
export declare function lifecycleObligations(db: Database.Database, instanceId: string, binding: Record<string, unknown> | null, steps: Pick<WorkflowStepSpec, "id">[], frontier: string[]): LifecycleObligation[];
//# sourceMappingURL=lifecycle-obligations.d.ts.map