import type { TmuxAdapter } from "./tmux.js";
import type { SeatLaunchEnvironment } from "../domain/seat-launch-environment.js";
import type { RuntimeAdapter, NodeBinding, ResolvedStartupFile, InstalledResource, ProjectionResult, StartupDeliveryResult, ReadinessResult, HarnessLaunchResult, ForkSource } from "../domain/runtime-adapter.js";
import type { ProjectionPlan } from "../domain/projection-planner.js";
import { type RunnerRuntime } from "./pi-runner-protocol.js";
export interface PiAdapterFsOps {
    readFile(path: string): string;
    writeFile(path: string, content: string): void;
    exists(path: string): boolean;
    mkdirp(path: string): void;
    listFiles?(dirPath: string): string[];
    statMode?(path: string): number;
    chmod?(path: string, mode: number): void;
}
export interface PiRuntimeAdapterDeps {
    tmux: TmuxAdapter;
    seatLaunchEnvironment?: SeatLaunchEnvironment;
    fsOps: PiAdapterFsOps;
    /** Root under which every Pi seat gets its isolated state dir (FR-7).
     *  Typically <OPENRIG_HOME>/state/pi. */
    stateRoot: string;
    /** Absolute path to the compiled pi-runner entry in the daemon dist. */
    runnerEntryPath: string;
    /** Trust posture for managed launches (BR-5 — always explicit; ambient
     *  `ask` silently skips in RPC mode). Default: "no-approve" (the
     *  conservative floor; seat-level guidance/skills live in the seat's
     *  managed agent dir, which needs no project trust). */
    trustPosture?: "approve" | "no-approve";
    sleep?: (ms: number) => Promise<void>;
    /** Launch-attempt id minting (tests inject; defaults to randomUUID). */
    newLaunchId?: () => string;
    /** OPR.0.7.0.2: whether usage.pi_cost_facts is on, read at each launch (absent = off). */
    usageFactsEnabled?: () => boolean;
    /** OPR.0.7.0.2 K4: whether usage.pi_openrouter_charge is on, read at each launch (absent = off). */
    openRouterChargeEnabled?: () => boolean;
}
export declare class PiRuntimeAdapter implements RuntimeAdapter {
    readonly runtime: RunnerRuntime;
    private tmux;
    private seatLaunchEnvironment?;
    private fs;
    protected stateRoot: string;
    private runnerEntryPath;
    private trustPosture;
    private sleep;
    private newLaunchId;
    private usageFactsEnabled;
    private openRouterChargeEnabled;
    constructor(deps: PiRuntimeAdapterDeps);
    /** The pi-runner sidecar reader shape resume-token-capture consumes
     *  (deriveResumeToken's piRunnerStateStore dep). */
    readSessionFile(sessionName: string): {
        ok: true;
        sessionFile: string;
    } | {
        ok: false;
        reason: string;
    };
    listInstalled(binding: NodeBinding): Promise<InstalledResource[]>;
    /** Conflict detection must inspect this seat's copy, not a Claude sibling. */
    skillTargetPath(tmuxSession: string | null, effectiveId: string): string | null;
    project(plan: ProjectionPlan, binding: NodeBinding): Promise<ProjectionResult>;
    deliverStartup(files: ResolvedStartupFile[], binding: NodeBinding): Promise<StartupDeliveryResult>;
    launchHarness(binding: NodeBinding, opts: {
        name: string;
        resumeToken?: string;
        forkSource?: ForkSource;
    }): Promise<HarnessLaunchResult>;
    checkReady(binding: NodeBinding): Promise<ReadinessResult>;
    private readRunnerState;
    private waitForRunnerReady;
    private projectEntry;
    private preserveMode;
    private mergeGuidance;
}
//# sourceMappingURL=pi-runtime-adapter.d.ts.map