import type { RuntimeAdapter, InstalledResource, NodeBinding, ProjectionResult, StartupDeliveryResult, ReadinessResult, ResolvedStartupFile, HarnessLaunchResult } from "../domain/runtime-adapter.js";
import type { ProjectionPlan } from "../domain/projection-planner.js";
/**
 * Terminal runtime adapter for infrastructure nodes.
 * All operations are no-ops — the shell is immediately interactive.
 * Startup actions (send_text) are handled by the startup orchestrator,
 * not by this adapter.
 */
export declare class TerminalAdapter implements RuntimeAdapter {
    readonly runtime = "terminal";
    listInstalled(_binding: NodeBinding): Promise<InstalledResource[]>;
    project(_plan: ProjectionPlan, _binding: NodeBinding): Promise<ProjectionResult>;
    deliverStartup(_files: ResolvedStartupFile[], _binding: NodeBinding): Promise<StartupDeliveryResult>;
    launchHarness(_binding: NodeBinding, opts: {
        name: string;
        resumeToken?: string;
        forkSource?: import("../domain/runtime-adapter.js").ForkSource;
    }): Promise<HarnessLaunchResult>;
    checkReady(_binding: NodeBinding): Promise<ReadinessResult>;
}
//# sourceMappingURL=terminal-adapter.d.ts.map