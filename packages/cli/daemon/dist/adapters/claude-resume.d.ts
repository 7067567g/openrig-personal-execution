import type { TmuxAdapter } from "./tmux.js";
import type { SeatLaunchEnvironment } from "../domain/seat-launch-environment.js";
import { type ClaudeLaunchedProcess, type NativeProcessLister } from "../domain/native-process-lineage.js";
import { type AppliedLaunchObservation } from "../domain/permission-drift.js";
import type { ClaudeManagedLaunch } from "../domain/claude-managed-launch.js";
export type ResumeResult = {
    ok: true;
    appliedLaunch?: AppliedLaunchObservation;
    launchedProcess?: ClaudeLaunchedProcess;
} | {
    ok: false;
    code: "attention_required";
    message: string;
    evidence?: string;
} | {
    ok: false;
    code: string;
    message: string;
};
/** The legacy name and native ID are both supported Claude resume inputs. */
export declare function isClaudeResumeType(resumeType: string | null | undefined): boolean;
interface ClaudeResumeOptions {
    seatLaunchEnvironment?: SeatLaunchEnvironment;
    claudeManagedLaunch?: ClaudeManagedLaunch;
    listProcesses?: NativeProcessLister;
    pollMs?: number;
    maxWaitMs?: number;
    sleep?: (ms: number) => Promise<void>;
}
export declare class ClaudeResumeAdapter {
    private tmux;
    private options;
    constructor(tmux: TmuxAdapter, options?: ClaudeResumeOptions);
    canResume(resumeType: string | null, resumeToken: string | null): boolean;
    resume(tmuxSessionName: string, resumeType: string | null, resumeToken: string | null, cwd: string, resolvedPosture?: "floor" | "full_bypass" | "auto", model?: string | null, selectedPermissionMode?: string, nodeId?: string, effort?: string | null, nonInterruptive?: boolean, kernelAuthority?: boolean, teamPermissionDefault?: boolean): Promise<ResumeResult>;
    private verifyResume;
}
export {};
//# sourceMappingURL=claude-resume.d.ts.map