import type { ResolvedPackage, FsOps } from "./package-resolver.js";
export type ActionClassification = "safe_projection" | "managed_merge" | "config_mutation" | "external_install" | "manual_only";
export interface ConflictInfo {
    existingPath: string;
    existingHash?: string;
    sourceHash?: string;
    reason: string;
}
export interface InstallPlanEntry {
    exportType: string;
    exportName: string;
    classification: ActionClassification;
    targetPath: string;
    scope: string;
    sourcePath?: string;
    conflict?: ConflictInfo;
    deferred: boolean;
    deferReason?: string;
}
export interface InstallPlan {
    packageId?: string;
    packageName: string;
    packageVersion: string;
    sourceRef: string;
    entries: InstallPlanEntry[];
    actionable: InstallPlanEntry[];
    deferred: InstallPlanEntry[];
    conflicts: InstallPlanEntry[];
}
export interface PlanOptions {
    roleName?: string;
}
export declare class InstallPlanner {
    private fs;
    constructor(fs: FsOps);
    plan(resolved: ResolvedPackage, targetRoot: string, runtime: "claude-code" | "codex", options?: PlanOptions): InstallPlan;
}
//# sourceMappingURL=install-planner.d.ts.map