export type NativeResumeProbeStatus = "resumed" | "failed" | "inconclusive" | "attention_required";
export interface NativeResumeProbeInput {
    runtime: string | null;
    paneCommand: string | null;
    paneContent: string | null;
    /** Only the managed adapter supplies this after exact, stable native-process proof. */
    claudeAutoIdentityVerified?: boolean;
    /** Only an exact --resume process-lineage proof may use the visible composer as readiness. */
    claudeResumeIdentityVerified?: boolean;
}
export interface NativeResumeProbeResult {
    status: NativeResumeProbeStatus;
    code: string;
    detail: string;
}
export interface ProbeShellReadyInput {
    paneCommand: string | null;
    paneContent: string | null;
}
export declare function buildNativeResumeCommand(runtime: string | null, resumeToken: string | null, sessionName?: string | null, codexConfigProfile?: string | null, 
/** Codex: the seat's recorded daemon choice; only a positive true adds --no-daemon (absent and false print as before). */
codexDaemonOptOut?: boolean): string | null;
export declare function buildCodexResumeCore(resumeToken: string, codexConfigProfile?: string | null, useLast?: boolean, extraArgs?: string, resolvedPosture?: "floor" | "full_bypass" | "auto", model?: string | null, 
/** Launch callers may pass the exact already-resolved segment they insert, avoiding a second policy decision. */
precomputedPostureArg?: string, 
/** #69: launch callers pass true when the installed Codex supports `--no-daemon`. Absent → byte-identical. */
daemonOptOut?: boolean, 
/** #75: optional reasoning effort for the seat. Emitted as -c 'model_reasoning_effort="<level>"'. */
effort?: string | null): string;
export declare function assessNativeResumeProbe(input: NativeResumeProbeInput): NativeResumeProbeResult;
export declare function isProbeShellReady(input: ProbeShellReadyInput): boolean;
/** Header formats observed before and since Codex 0.160.0. */
export declare function hasCodexUpdateHeader(paneContent: string): boolean;
//# sourceMappingURL=native-resume-probe.d.ts.map