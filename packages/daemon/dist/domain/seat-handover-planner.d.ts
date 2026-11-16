import type { RigRepository } from "./rig-repository.js";
import { type SeatStatus, type SeatStatusResult } from "./seat-status-service.js";
export type SeatHandoverSourceMode = "fresh" | "rebuild" | "fork" | "discovered";
export interface SeatHandoverSource {
    mode: SeatHandoverSourceMode;
    ref: string | null;
    raw: string;
    defaulted: boolean;
}
export interface SeatHandoverStep {
    id: string;
    title: string;
    description: string;
    willMutate: false;
}
export interface SeatHandoverPhase {
    id: "prepare" | "commit";
    title: string;
    bindingUnchangedUntilComplete: boolean;
    steps: SeatHandoverStep[];
}
export interface SeatHandoverPlan {
    ok: true;
    dryRun: true;
    willMutate: false;
    seat: {
        ref: string;
        rigId: string;
        rigName: string;
        logicalId: string;
        podId: string | null;
        podNamespace: string | null;
        runtime: string | null;
    };
    source: SeatHandoverSource;
    reason: string;
    operator: string | null;
    currentOccupant: string | null;
    currentStatus: {
        sessionStatus: string | null;
        startupStatus: SeatStatus["startup_status"];
        occupantLifecycle: SeatStatus["occupant_lifecycle"];
        continuityOutcome: SeatStatus["continuity_outcome"];
        handoverResult: SeatStatus["handover_result"];
        previousOccupant: string | null;
        handoverAt: string | null;
        restoreOutcome: SeatStatus["restore_outcome"];
    };
    phases: SeatHandoverPhase[];
}
export type SeatHandoverPlanResult = {
    ok: true;
    plan: SeatHandoverPlan;
} | {
    ok: false;
    code: "missing_reason" | "invalid_source" | "mutation_disabled";
    message: string;
    guidance: string;
} | Extract<SeatStatusResult, {
    ok: false;
}>;
export declare class SeatHandoverPlanner {
    private statusService;
    constructor(deps: {
        rigRepo: RigRepository;
    });
    plan(input: {
        seatRef: string;
        reason?: string | null;
        source?: string | null;
        operator?: string | null;
        dryRun?: boolean;
    }): SeatHandoverPlanResult;
}
/**
 * OPR.0.5.5.5 — the ONE source-capability table shared by the dry-run plan and
 * the mutation executor. The plan renders what a source DOES from this table
 * and the executor dispatches on the same rows, so the plan can never promise
 * a source the executor refuses (and vice versa). Adding a mode to
 * `SeatHandoverSourceMode` forces a row here (exhaustive Record).
 */
export declare const SEAT_HANDOVER_SOURCE_CAPABILITIES: Record<SeatHandoverSourceMode, {
    /** True when the mutation path executes this source end-to-end. A false row
     *  is the ONLY thing that may produce `source_not_supported`. */
    executes: boolean;
    /** How the successor receives its context under this source. */
    contextCarrier: string;
}>;
export declare function parseHandoverSource(source?: string | null): {
    ok: true;
    source: SeatHandoverSource;
} | {
    ok: false;
    code: "invalid_source";
    message: string;
    guidance: string;
};
//# sourceMappingURL=seat-handover-planner.d.ts.map