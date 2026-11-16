import type { ProbeResult } from "./requirements-probe.js";
/** Approval classification for an external install action */
export type ApprovalClassification = "auto_approvable" | "review_required" | "manual_only";
/** A single external install action in the plan */
export interface ExternalInstallAction {
    requirementName: string;
    kind: "cli_tool" | "system_package";
    provider: string | null;
    commandPreview: string | null;
    classification: ApprovalClassification;
    installHints: Record<string, string> | null;
    reason: string;
}
/** The full external install plan */
export interface ExternalInstallPlan {
    actions: ExternalInstallAction[];
    autoApprovable: ExternalInstallAction[];
    reviewRequired: ExternalInstallAction[];
    manualOnly: ExternalInstallAction[];
    alreadyInstalled: string[];
}
interface PlannerOptions {
    platform?: string;
}
/**
 * Maps missing requirements to trusted provider install actions.
 * Phase 5 ships Homebrew (darwin) only. All other platforms produce manual_only.
 * install_hints from manifests are display-only — never executed.
 */
export declare class ExternalInstallPlanner {
    private platform;
    constructor(opts?: PlannerOptions);
    /**
     * Build an install plan from probe results.
     * @param probeResults - results from RequirementsProbeRegistry.probeAll()
     */
    planInstalls(probeResults: ProbeResult[]): ExternalInstallPlan;
    private mapToAction;
}
export {};
//# sourceMappingURL=external-install-planner.d.ts.map