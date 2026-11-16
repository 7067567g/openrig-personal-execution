export type AppliedLaunchAxis = "permission" | "sandbox" | "resource_trust" | "not_applicable";
export type AppliedLaunchState = "observed" | "unknown";
export interface AppliedLaunchObservation {
    runtime: string;
    axis: AppliedLaunchAxis;
    state: AppliedLaunchState;
    value: string | null;
    reason?: string;
    /** Emitted Codex approval argument; null/absent does not infer a native default. */
    approvalPolicy?: "never" | null;
    /** Codex: true when the launch added --no-daemon, false when the probe found no such option; absent when not probed. */
    daemonOptOut?: boolean;
}
export type TransportState = "healthy" | "connect" | "timeout" | "response";
export type CwdReadState = "visible" | "denied" | "unknown";
export type CommandPathState = "available" | "missing" | "unknown";
export type EnforcementState = "aligned" | "drift" | "unknown";
export interface EffectiveClaudePermission {
    defaultMode: string;
    allow: string[];
    ask: string[];
    deny: string[];
}
export interface RuntimeEnforcementDiagnostic {
    axis: AppliedLaunchAxis;
    state: EnforcementState;
    expected: string | null;
    effective: string | EffectiveClaudePermission | null;
    sourcePath: string | null;
    reason?: string;
}
export interface PermissionDriftDiagnostic {
    transport: {
        state: TransportState;
    };
    cwdRead: {
        state: CwdReadState;
    };
    commandPath: {
        state: CommandPathState;
    };
    enforcement: RuntimeEnforcementDiagnostic;
    /** File comparison only; neither a settings file nor an argument proves native enforcement. */
    configuration?: {
        comparison: EnforcementState;
        expected: string | null;
        observed: EffectiveClaudePermission | null;
        sourcePath: string | null;
        reason?: string;
    };
    observedAt: string;
}
export interface PermissionDriftFs {
    readFile(path: string): string;
    cwdReadable(path: string): boolean | null;
    commandAvailable(command: string): boolean | null;
    /** Live harness-derived Claude permission-mode vocabulary. null = unresolved. */
    claudePermissionModes(): string[] | null;
}
export declare function parseClaudePermissionModes(help: string): string[] | null;
export declare function observeClaudePermission(flag: string): AppliedLaunchObservation;
export declare function observeCodexSandbox(arg: string): AppliedLaunchObservation;
export declare function observePiResourceTrust(trust: "approve" | "no-approve"): AppliedLaunchObservation;
export declare function observeOmpApprovalMode(arg: string): AppliedLaunchObservation;
export declare function diagnoseRuntimePosture(input: {
    runtime: string;
    cwd: string | null;
    applied: AppliedLaunchObservation | null;
    fs: PermissionDriftFs;
    now?: () => Date;
}): PermissionDriftDiagnostic;
export declare function renderPermissionDriftSummary(diagnostic: PermissionDriftDiagnostic): string;
//# sourceMappingURL=permission-drift.d.ts.map