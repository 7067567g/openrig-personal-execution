import type { SliceDetailSnap } from "../types.js";
import { type ContentLine } from "../detail.js";
import { type MissionScopesSnap } from "../scopes/scopes-model.js";
export interface ExecutionViewSnap {
    readiness?: {
        historicalStatus?: string | null;
        revision: string;
        state: string;
        slices: Array<{
            scope: string;
            readiness: import("../scopes/scopes-model.js").ReadinessSnap;
        }>;
    };
    view: "execution";
    mission: string;
    derived_at?: string;
    sources: Record<string, unknown>;
    q1_lanes: Array<Record<string, unknown>>;
    q2_sequencing: Array<Record<string, unknown>>;
    q3_care?: Array<Record<string, unknown>>;
    q4_ladder: Array<Record<string, unknown>>;
    q5_park: Array<Record<string, unknown>>;
    q6_parallelism?: Record<string, unknown>;
    /** S06: existing workflow engine facts joined to the selected mission. */
    lifecycle_instances?: Array<Record<string, unknown>>;
    planning_guidance?: Array<{
        label: string;
        text: string;
        source: string;
        wave?: string;
    }>;
}
export declare function executionContentLines(execution: ExecutionViewSnap | null | undefined, scopes: readonly MissionScopesSnap[] | undefined, readErrors: readonly string[], opened: string | null, width?: number, pending?: boolean, sliceDetailRead?: SliceDetailSnap | null, scopeOpts?: {
    collapseReqs: boolean;
    narrative: boolean;
}, timeZone?: string): ContentLine[];
/** Compact source-grounded execution strip embedded in the existing rich SCOPES
 * slice detail. Missing projection/slice data stays explicit instead of being inferred. */
export declare function executionSliceStripLines(execution: ExecutionViewSnap | null | undefined, sliceId: string, sliceDir: string, width?: number, declared?: string | null): ContentLine[];
//# sourceMappingURL=execution-model.d.ts.map