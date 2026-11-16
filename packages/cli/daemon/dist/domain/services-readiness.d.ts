import type { ComposeServicesAdapter, ComposeServiceStatus } from "../adapters/compose-services-adapter.js";
import type { RigServicesWaitTarget } from "./types.js";
export interface WaitTargetResult {
    target: RigServicesWaitTarget;
    status: "healthy" | "unhealthy" | "pending";
    detail: string | null;
}
/**
 * Shared readiness evaluator. ONE place for wait-target evaluation and derived
 * env health logic.
 *
 * Shipped consumers:
 * - boot-time health gate (ServiceOrchestrator.boot)
 * - on-demand receipt capture (ServiceOrchestrator.captureReceipt → env route)
 *
 * Deferred:
 * - background health monitor (not yet implemented)
 * - rig ps env summary (not yet implemented)
 */
export declare function evaluateWaitTargets(targets: RigServicesWaitTarget[], adapter: ComposeServicesAdapter, composeStatuses?: ComposeServiceStatus[]): Promise<WaitTargetResult[]>;
/** Derive overall env health from wait target results. */
export declare function deriveEnvHealth(results: WaitTargetResult[]): "healthy" | "degraded" | "unhealthy";
//# sourceMappingURL=services-readiness.d.ts.map