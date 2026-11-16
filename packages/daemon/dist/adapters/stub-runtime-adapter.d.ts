import type { TmuxAdapter } from "./tmux.js";
import type { RuntimeAdapter, NodeBinding, ResolvedStartupFile, InstalledResource, ProjectionResult, StartupDeliveryResult, ReadinessResult, HarnessLaunchResult, ForkSource } from "../domain/runtime-adapter.js";
import type { ProjectionPlan } from "../domain/projection-planner.js";
export interface StubAdapterFsOps {
    readFile(path: string): string;
    writeFile(path: string, content: string): void;
    exists(path: string): boolean;
    mkdirp(path: string): void;
    listFiles?(dirPath: string): string[];
}
export interface StubRuntimeAdapterDeps {
    tmux: TmuxAdapter;
    /** Real filesystem operations. Absent in minimal/hermetic test constructions —
     *  the adapter then falls back to an in-memory launch record for readiness and
     *  performs NO real filesystem writes (so a `cwd: "."` binding never pollutes
     *  the daemon's own working directory). Production always wires this. */
    fsOps?: StubAdapterFsOps;
    /** Runtime label. Defaults to "stub"; accepted as a dep so a test can name it. */
    runtime?: string;
    /** Absolute path to the compiled stub-runner entry in the daemon dist. When
     *  present, launchHarness spawns the real runner (with a MANDATORY existence
     *  fail-fast); when absent, launchHarness takes the hermetic in-memory path. */
    runnerEntryPath?: string;
    sleep?: (ms: number) => Promise<void>;
    /** Launch-attempt id minting (tests inject; defaults to randomUUID). */
    newLaunchId?: () => string;
}
export declare class StubRuntimeAdapter implements RuntimeAdapter {
    readonly runtime: string;
    private tmux;
    private fsOps?;
    private runnerEntryPath?;
    private sleep;
    private newLaunchId;
    private readonly launchRecords;
    constructor(deps: StubRuntimeAdapterDeps);
    listInstalled(_binding: NodeBinding): Promise<InstalledResource[]>;
    project(plan: ProjectionPlan, binding: NodeBinding): Promise<ProjectionResult>;
    deliverStartup(files: ResolvedStartupFile[], binding: NodeBinding): Promise<StartupDeliveryResult>;
    launchHarness(binding: NodeBinding, opts: {
        name: string;
        resumeToken?: string;
        forkSource?: ForkSource;
    }): Promise<HarnessLaunchResult>;
    checkReady(binding: NodeBinding): Promise<ReadinessResult>;
    private readReadinessSidecar;
    private waitForRunnerReady;
    private projectEntry;
    private mergeGuidance;
}
//# sourceMappingURL=stub-runtime-adapter.d.ts.map