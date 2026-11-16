import type Database from "better-sqlite3";
import type { RestoreExcludedNode, RestoreNodeResult, RestoreResult, RestoreRigResult, RestoreSnapshotSelection } from "./types.js";
export interface RestoreAttemptReceipt {
    ok: true;
    attemptId: number;
    rigId: string;
    snapshotSelection: RestoreSnapshotSelection | null;
    intendedRoster: Array<{
        nodeId: string;
        logicalId: string;
    }>;
    excludedNodes: RestoreExcludedNode[];
    originalResult: RestoreResult;
    reconciliations: Array<{
        nodeId: string;
        from: "failed" | "attention_required";
        to: "operator_recovered";
        evidence: unknown;
        seq: number;
        createdAt: string;
    }>;
    currentNodes: RestoreNodeResult[];
    unresolvedIntendedSeats: RestoreNodeResult[];
    currentIntendedSetVerdict: RestoreRigResult;
}
export type RestoreAttemptReceiptOutcome = RestoreAttemptReceipt | {
    ok: false;
    code: "attempt_not_found" | "attempt_wrong_rig" | "attempt_incomplete" | "attempt_corrupt";
    message: string;
};
/** Fold append-only restore events into the current attempt view. No row is
 * written and the original restore.completed payload is returned untouched. */
export declare function deriveRestoreAttemptReceipt(db: Database.Database, rigId: string, attemptId: number): RestoreAttemptReceiptOutcome;
//# sourceMappingURL=restore-attempt-receipt.d.ts.map