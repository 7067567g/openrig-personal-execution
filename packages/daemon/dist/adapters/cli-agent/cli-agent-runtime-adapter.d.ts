import type { TmuxAdapter } from "../tmux.js";
import type { SeatLaunchEnvironment } from "../../domain/seat-launch-environment.js";
import type { RuntimeAdapter, NodeBinding, ResolvedStartupFile, InstalledResource, ProjectionResult, StartupDeliveryResult, ReadinessResult, HarnessLaunchResult, ForkSource } from "../../domain/runtime-adapter.js";
import type { ProjectionPlan } from "../../domain/projection-planner.js";
import { type CliAgentRuntime } from "./cli-agent-runner-protocol.js";
import type { TaskBudgetConfig } from "./task-budget.js";
export interface CliAgentAdapterFsOps {
    readFile(path: string): string;
    writeFile(path: string, content: string): void;
    exists(path: string): boolean;
    mkdirp(path: string): void;
    listFiles?(dirPath: string): string[];
}
export interface CliAgentRuntimeAdapterDeps {
    runtime: CliAgentRuntime;
    tmux: TmuxAdapter;
    seatLaunchEnvironment?: SeatLaunchEnvironment;
    fsOps: CliAgentAdapterFsOps;
    /** Absolute path to the compiled cli-agent-runner entry. */
    runnerEntryPath: string;
    /** Root under which each seat's runner state lives. */
    stateRoot: string;
    /** Runtime executable. Explicit values are preferred over PATH resolution. */
    bin?: string;
    /** Optional default model (OpenCode provider/model). */
    model?: string;
    /** Optional default agent (OpenCode agent name). */
    agent?: string;
    /** DSH profile (ignored by OpenCode). */
    profile?: string;
    /** Fresh-read per-turn budget. Omitted/undefined keeps budgets off (the default). */
    turnBudget?: () => TaskBudgetConfig | undefined;
    sleep?: (ms: number) => Promise<void>;
    newLaunchId?: () => string;
}
export declare class CliAgentRuntimeAdapter implements RuntimeAdapter {
    readonly runtime: CliAgentRuntime;
    private readonly tmux;
    private readonly seatLaunchEnvironment?;
    private readonly fs;
    private readonly runnerEntryPath;
    private readonly stateRoot;
    private readonly bin?;
    private readonly model?;
    private readonly agent?;
    private readonly profile?;
    private readonly turnBudget?;
    private readonly sleep;
    private readonly newLaunchId;
    constructor(deps: CliAgentRuntimeAdapterDeps);
    listInstalled(binding: NodeBinding): Promise<InstalledResource[]>;
    project(plan: ProjectionPlan, binding: NodeBinding): Promise<ProjectionResult>;
    deliverStartup(files: ResolvedStartupFile[], binding: NodeBinding): Promise<StartupDeliveryResult>;
    launchHarness(binding: NodeBinding, opts: {
        name: string;
        resumeToken?: string;
        forkSource?: ForkSource;
    }): Promise<HarnessLaunchResult>;
    checkReady(binding: NodeBinding): Promise<ReadinessResult>;
    /** Resume-metadata source for ResumeMetadataRefresher/deriveResumeToken. */
    readSessionFile(sessionName: string): {
        ok: true;
        sessionFile: string;
    } | {
        ok: false;
        reason: string;
    };
    private readState;
    private projectEntry;
    private installSkill;
    private copyPath;
    private mergeGuidance;
}
//# sourceMappingURL=cli-agent-runtime-adapter.d.ts.map