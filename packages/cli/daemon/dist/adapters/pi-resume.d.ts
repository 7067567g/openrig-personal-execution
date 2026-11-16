import type { TmuxAdapter } from "./tmux.js";
import type { SeatLaunchEnvironment } from "../domain/seat-launch-environment.js";
import type { ResumeResult } from "./claude-resume.js";
import { type RunnerRuntime } from "./pi-runner-protocol.js";
export { type ResumeResult };
export interface PiResumeFsOps {
    readFile(path: string): string;
    writeFile(path: string, content: string): void;
    exists(path: string): boolean;
    mkdirp(path: string): void;
}
interface PiResumeOptions {
    seatLaunchEnvironment?: SeatLaunchEnvironment;
    pollMs?: number;
    maxWaitMs?: number;
    sleep?: (ms: number) => Promise<void>;
    trustPosture?: "approve" | "no-approve";
    /** Launch-attempt id minting (tests inject; defaults to randomUUID). */
    newLaunchId?: () => string;
    /** OPR.0.7.0.2: whether usage.pi_cost_facts is on, read at each resume (absent = off). */
    usageFactsEnabled?: () => boolean;
    /** OPR.0.7.0.2 K4: whether usage.pi_openrouter_charge is on, read at each resume (absent = off). */
    openRouterChargeEnabled?: () => boolean;
}
export declare class PiResumeAdapter {
    private tmux;
    private fs;
    private paths;
    private options;
    protected readonly runtime: RunnerRuntime;
    /** Operator-facing name in resume messages; Pi keeps main's wording. */
    private get label();
    constructor(tmux: TmuxAdapter, fs: PiResumeFsOps, paths: {
        stateRoot: string;
        runnerEntryPath: string;
    }, options?: PiResumeOptions);
    canResume(resumeType: string | null, resumeToken: string | null): boolean;
    resume(tmuxSessionName: string, resumeType: string | null, resumeToken: string | null, cwd: string, model?: string | null, resolvedPosture?: "floor" | "full_bypass" | "auto"): Promise<ResumeResult>;
    private verifyResume;
    private readSafe;
}
//# sourceMappingURL=pi-resume.d.ts.map