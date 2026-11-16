import type { InstallPlanEntry } from "./install-planner.js";
import type { RefinedInstallPlan } from "./conflict-detector.js";
export interface PolicyRejection {
    entry: InstallPlanEntry;
    reason: string;
}
export interface PolicyResult {
    approved: InstallPlanEntry[];
    rejected: PolicyRejection[];
}
/**
 * Thin policy gate for install plan entries.
 * Processes plan.actionable for classification-based approval,
 * and plan.conflicts as always-rejected. Does not double-process
 * entries that appear in both arrays.
 */
export declare function applyPolicy(plan: RefinedInstallPlan, options?: {
    allowMerge?: boolean;
}): PolicyResult;
//# sourceMappingURL=install-policy.d.ts.map