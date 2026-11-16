import { type PrepareCodexTeamWorkspace } from "../domain/codex-team-workspace.js";
import type { TmuxAdapter } from "./tmux.js";
import type { SeatLaunchEnvironment } from "../domain/seat-launch-environment.js";
import type { ResumeResult } from "./claude-resume.js";
import { type NativeProcessLister } from "../domain/native-process-lineage.js";
import { type CodexDaemonSupportDetector } from "../domain/codex-daemon-support.js";
import { type CodexNetworkDefaultReader } from "../domain/codex-network-default.js";
export { type ResumeResult };
interface CodexResumeOptions {
    prepareTeamWorkspace?: PrepareCodexTeamWorkspace;
    seatLaunchEnvironment?: SeatLaunchEnvironment;
    launchPath?: string;
    codexHome?: string;
    pollMs?: number;
    maxWaitMs?: number;
    sleep?: (ms: number) => Promise<void>;
    exec?: (cmd: string) => Promise<string>;
    /** #69: whether the installed Codex supports --no-daemon; absent keeps the existing invocation. */
    detectDaemonSupport?: CodexDaemonSupportDetector;
    /** #275: Codex's own answer on the plain floor's network default; absent keeps the existing invocation. */
    readNetworkDefault?: CodexNetworkDefaultReader;
    /** Ensure the managed Codex config (hooks, trust) just before a resume, as a runtime-adapter launch does. */
    ensureManagedConfig?: () => Promise<void>;
    /** Process rows for the idle-shell check; defaults to the OS listing. */
    listProcesses?: NativeProcessLister;
}
export declare class CodexResumeAdapter {
    private tmux;
    private options;
    constructor(tmux: TmuxAdapter, options?: CodexResumeOptions);
    canResume(resumeType: string | null, resumeToken: string | null): boolean;
    resume(tmuxSessionName: string, resumeType: string | null, resumeToken: string | null, cwd: string, codexConfigProfile?: string | null, resolvedPosture?: "floor" | "full_bypass" | "auto", model?: string | null, effort?: string | null, nonInterruptive?: boolean, kernelAuthority?: boolean, teamPermissionDefault?: boolean): Promise<ResumeResult>;
    private verifyResume;
}
//# sourceMappingURL=codex-resume.d.ts.map