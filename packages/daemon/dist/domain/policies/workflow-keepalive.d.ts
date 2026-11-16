import type Database from "better-sqlite3";
import type { Policy } from "./types.js";
export interface WorkflowKeepaliveDeps {
    db: Database.Database;
    /** OPR.0.4.6.WF5 FR-2 class (b): when supplied, a non-healthy deadline
     *  verdict ENSURES the durable exception item at detection time as a
     *  side effect of this evaluation. The PolicyEvaluation SHAPE is
     *  untouched (send|skip|terminal stands — X5); the item is the
     *  injected helper's concern, dedup by occurrence. Failures are
     *  non-fatal to the evaluation. */
    ensureStuckExceptionItem?: import("../workflow-exception-escalation.js").EnsureStuckExceptionItem;
    reconcileStuckExceptions?: (instanceId: string) => number;
}
export declare function makeWorkflowKeepalivePolicy(deps: WorkflowKeepaliveDeps): Policy;
//# sourceMappingURL=workflow-keepalive.d.ts.map