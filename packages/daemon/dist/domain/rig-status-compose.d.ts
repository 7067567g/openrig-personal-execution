import type { NodeLifecycleState } from "./types.js";
import type { RestorePlanPreview } from "./restore-plan-preview.js";
import type { ResumeTokenState } from "./restore-plan-preview.js";
import type { RecoveryPlan } from "./restore-check-service.js";
import type { KernelState } from "./kernel-boot-tracker.js";
/** The composed rig-level aggregate. A pure fold — never a verdict that
 *  overwrites per-seat truth. */
export type RigAggStatus = "up" | "partial" | "down" | "blocked" | "unknown";
export interface RigStatusSeat {
    logicalId: string;
    runtime: string | null;
    /** Live process lifecycle (ps-projection). */
    lifecycleState: NodeLifecycleState;
    /** Read-only restore-plan forecast (restore-plan-preview). */
    tokenState: ResumeTokenState;
    intendedAction: "resume-original" | "fresh-primed" | "awaiting-decision";
    freshRequired: boolean;
    /** True when THIS seat blocks a restore-original (awaiting-decision) — the
     *  per-seat blocker that folds up to the aggregate `blocked`. */
    blocked: boolean;
    provenance?: string | null;
    lastVerified?: string | null;
    reason?: string;
    runtimePrompt?: string;
}
export interface RigStatusObject {
    rigId: string;
    rigName: string;
    isKernel: boolean;
    status: RigAggStatus;
    seatsTotal: number;
    seatsRunning: number;
    /** true when the rig can be recovered without operator action (down/partial);
     *  false when blocked (needs a decision) or already up. */
    recoverable: boolean;
    perSeat: RigStatusSeat[];
    /** Composed provenance — the folded signals + their values. Visible in the UI
     *  `src:` line and in debug/test output (the non-inference contract). */
    src: string[];
}
export interface SeatLifecycleInput {
    logicalId: string;
    runtime: string | null;
    lifecycleState: NodeLifecycleState;
}
export interface ComposeRigStatusInput {
    rigId: string;
    rigName: string;
    isKernel?: boolean;
    /** Per-node ps-lifecycle truth (from node-inventory). */
    nodes: SeatLifecycleInput[];
    /** Read-only restore-plan forecast (buildRestorePlanPreview) — NOT mutated. */
    plan: RestorePlanPreview;
    /** restore-check recovery readiness for this rig (optional; folded when present). */
    recovery?: RecoveryPlan | null;
    /** kernel-status state — folded ONLY for the kernel rig (never /healthz). */
    kernelState?: KernelState | null;
}
/** Fold the four backend signals into a single rig-status object. Pure — does
 *  NOT mutate the input plan (the resumable seats stay resume-original). */
export declare function composeRigStatus(input: ComposeRigStatusInput): RigStatusObject;
//# sourceMappingURL=rig-status-compose.d.ts.map