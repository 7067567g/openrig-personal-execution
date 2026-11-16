import type { RuntimeAdapter, InstalledResource, NodeBinding, ProjectionResult, StartupDeliveryResult, ReadinessResult, ResolvedStartupFile, HarnessLaunchResult, ForkSource } from "../domain/runtime-adapter.js";
import type { ProjectionPlan } from "../domain/projection-planner.js";
import type { TmuxAdapter } from "./tmux.js";
import type { SeatLaunchEnvironment } from "../domain/seat-launch-environment.js";
interface AgentAppAdapterDeps {
    tmux: Pick<TmuxAdapter, "hasSession" | "getPaneCommand" | "sendShellCommand">;
    seatLaunchEnvironment?: Pick<SeatLaunchEnvironment, "command">;
    presetsDir?: () => string;
}
/**
 * A community agent app, launched from its installed preset (`domain/agent-app-presets.ts`). It types the preset's
 * command into the seat's pane and is ready while the pane runs something other than a shell. That's readiness, not
 * identity: a process alone doesn't prove which session it is. It projects nothing, and refuses resume and fork,
 * which a launch-only preset doesn't support.
 */
export declare class AgentAppRuntimeAdapter implements RuntimeAdapter {
    readonly runtime: string;
    private readonly deps;
    constructor(runtime: string, deps: AgentAppAdapterDeps);
    listInstalled(_binding: NodeBinding): Promise<InstalledResource[]>;
    project(plan: ProjectionPlan, _binding: NodeBinding): Promise<ProjectionResult>;
    deliverStartup(files: ResolvedStartupFile[], _binding: NodeBinding): Promise<StartupDeliveryResult>;
    launchHarness(binding: NodeBinding, opts: {
        name: string;
        resumeToken?: string;
        forkSource?: ForkSource;
    }): Promise<HarnessLaunchResult>;
    checkReady(binding: NodeBinding): Promise<ReadinessResult>;
}
/**
 * The runtime adapter map, extended with community agent apps: a runtime name that isn't built in resolves to an
 * AgentAppRuntimeAdapter while its preset is installed. The built-in entries are returned as they are, and the map's
 * own keys stay the built-ins.
 */
export declare function withAgentApps<T extends Record<string, RuntimeAdapter>>(builtIns: T, deps: AgentAppAdapterDeps): T;
/**
 * The runtime adapter map for relaunches (restore, seat lifecycle): exactly the built-ins, plus a hidden resolver for a
 * community agent app. Only `seatAdapter`, given a seat's recorded selection, reaches that resolver, so a seat whose
 * runtime merely matches an installed preset's name (a free-text self-attach) gets no adapter, as before.
 */
export declare function withAgentAppResolver<T extends Record<string, RuntimeAdapter>>(builtIns: T, deps: AgentAppAdapterDeps): T;
/** The adapter to relaunch a seat with: its runtime's built-in adapter, or, for a seat launched for a community agent
 *  app (`agentAppOf`), that app's adapter while its preset is installed. */
export declare function seatAdapter(map: Record<string, RuntimeAdapter> | undefined, runtime: string | null | undefined, agentApp: string | null | undefined): RuntimeAdapter | undefined;
export {};
//# sourceMappingURL=agent-app-runtime-adapter.d.ts.map