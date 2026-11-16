import type Database from "better-sqlite3";
import type { WorkflowInstance } from "./workflow-types.js";
import type { EventBus } from "./event-bus.js";
export interface GraphReconciliation {
    status: "current" | "source-only" | "compatible" | "incompatible" | "unavailable" | "unbound";
    adopted: boolean | null;
    boundDigest: string | null;
    proposedDigest: string | null;
    boundVersion: string;
    proposedVersion: string | null;
    compatible: boolean;
    changes: Array<{
        kind: string;
        ref: string;
        fields?: string[];
    }>;
    reasons: string[];
    composition: {
        mode: string;
        explanation: string;
        boundSlices: string[];
        executableSteps: Array<{
            id: string;
            dependsOn: string[];
        }>;
    };
    nextAction: string;
    applyCommand?: string;
    operationKey?: string;
    expectedVersion: number;
}
/** One derived comparison for CLI/TUI. Unchanged reads stat bound inputs,
 * not recompile every proof/manifest; replacement, deletion and revision invalidate it. */
export declare function inspectGraph(db: Database.Database, instanceId: string): GraphReconciliation;
/** Native effect readback survives lost responses and later authored changes.
 * Receipts live in the existing instance binding; prior specs/step/queue history remain. */
export declare function recoverGraphOperation(db: Database.Database, key: string): {
    kind: string;
    receipt: Record<string, unknown>;
    instance: WorkflowInstance;
} | null;
export declare function reviseGraph(db: Database.Database, bus: EventBus, input: {
    instanceId: string;
    operationKey: string;
    expectedVersion: number;
    expectedDigest: string;
    actorSession: string;
    reason: string;
}): {
    replayed: boolean;
    kind: string;
    receipt: Record<string, unknown>;
    instance: WorkflowInstance;
};
//# sourceMappingURL=workflow-reconciliation.d.ts.map