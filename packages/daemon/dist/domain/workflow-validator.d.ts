import type { WorkflowSpec } from "./workflow-types.js";
export interface ValidationIssue {
    code: string;
    /** Plain-English what + why + what-to-do. */
    message: string;
    /** Field path (e.g., "workflow.steps[1].actor_role"). */
    field?: string;
    /** Severity: error blocks; warning is informational. */
    severity: "error" | "warning";
}
export interface ValidationResult {
    ok: boolean;
    issues: ValidationIssue[];
    summary: {
        workflowId: string;
        workflowVersion: string;
        targetRig: string | null;
        entryRole: string | null;
        stepCount: number;
    };
}
export interface SeatLivenessCheckFn {
    (sessionRef: string): {
        alive: boolean;
        reason?: string;
    };
}
/** OPR.0.4.6.WF2 FR-3: host-registry membership probe. Injected by the
 *  runtime (built on the daemon hosts-registry reader) so the validator
 *  stays pure; absent (bare unit tests) skips the membership check —
 *  the production validate/instantiate path always injects it. */
export interface HostRegistryLookupFn {
    (hostId: string): {
        registered: boolean;
        registeredIds: string[];
    };
}
export declare class WorkflowValidator {
    validate(spec: WorkflowSpec, seatLivenessCheck?: SeatLivenessCheckFn, hostRegistryLookup?: HostRegistryLookupFn): ValidationResult;
}
//# sourceMappingURL=workflow-validator.d.ts.map