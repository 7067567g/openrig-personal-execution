export interface NativeProcessRow {
    pid: number;
    ppid: number;
    command: string;
    pgid?: number;
    tpgid?: number;
    executableName?: string;
    /** OS executable path, not argv[0], for otherwise unresolved Claude rows. */
    executablePath?: string;
    startedAt?: string;
}
export type NativeRuntime = "claude-code" | "codex";
/** A `ps` command line split the way identity proof splits it. */
export declare function processArgv(command: string): string[];
/** The conversation a Claude command line names (--resume, --session-id, or a fork's own --session-id);
 *  null when it names none or can't be parsed as one. */
export declare function claudeCommandSessionToken(command: string): string | null;
/** The conversation a Codex command line resumes: its token, null for a resume naming none, undefined
 *  when the command is not a resume at all (a fresh `codex -C …`). */
export declare function codexCommandResumeToken(command: string): string | null | undefined;
/** Require a live process in the pane's own lineage whose argv names both the
 * declared runtime and the exact native resume identity. For Claude, one search also accepts a
 * recorded rotation (#1077): the process that qualified it, naming the token it was launched on,
 * with no Claude beneath it in its foreground process group. */
export declare function findExactNativeResumeProcess(processes: NativeProcessRow[], panePid: number, runtime: string | null, expectedToken: string, rotation?: ClaudeResumeRotation | null): NativeProcessRow | null;
/** The same OS observation serves menu input, restore proof and periodic identity.
 * Older callers may carry only pid/ppid/command; that is insufficient positive Codex proof. */
export declare function listNativeProcesses(): Promise<NativeProcessRow[]>;
export type NativeProcessLister = () => NativeProcessRow[] | Promise<NativeProcessRow[]>;
/** One OS process, by pid and `ps` start time: a reused pid has another start time. */
export interface ClaudeLaunchedProcess {
    pid: number;
    startedAt: string;
}
/** A recorded Claude resume rotation (#1077): OpenRig launched `process` to resume `token`, and that
 *  process's first hook said the conversation continued as the stored token. argv may name `token`
 *  instead of the stored one only in that same process. */
export interface ClaudeResumeRotation {
    token: string;
    process: ClaudeLaunchedProcess;
}
export type NativeProcessObservation = {
    panePid: number;
    process: NativeProcessRow;
    fingerprint: string;
};
export type CodexProcessObservation = NativeProcessObservation;
/** Whether any process in the pane's subtree (the pane's own process included) has a Claude executable anywhere in its
 *  argv: the recognizer `findExactNativeResumeProcess` (via `commandUsesExpectedToken`) starts from. A Claude run as
 *  `node …/bin/claude`, or in the background, counts. */
export declare function subtreeNamesClaudeExecutable(rows: NativeProcessRow[], panePid: number): boolean;
/** Why `selectNativeProcess` rejects a snapshot, in the same order it checks. Used only to word a failed check;
 *  a test pins `kind: "passes"` to `selectNativeProcess` returning a process, so the two cannot drift apart. */
export type NativeRejection = {
    kind: "passes";
} | {
    kind: "no_single_process";
} | {
    kind: "no_recorded_conversation";
} | {
    kind: "names_no_conversation";
} | {
    kind: "not_a_resume";
} | {
    kind: "other_conversation";
    conversation: string;
} | {
    kind: "conflicting_conversations";
} | {
    kind: "rotation_process_mismatch";
    conversation: string;
};
export declare function explainNativeRejection(rows: NativeProcessRow[], panePid: number, runtime: NativeRuntime, expectedToken: string | null | undefined, requireResume: boolean, rotation?: ClaudeResumeRotation | null, selectedExecutable?: string): NativeRejection;
declare function observeNativePaneProcess(input: {
    target: string;
    tmux: {
        getPanePid(target: string): Promise<number | null>;
    };
    listProcesses?: NativeProcessLister;
    expectedToken?: string | null;
    requireResume?: boolean;
    /** Canonical executable frozen by the managed launch, never re-resolved at observation time. */
    selectedExecutable?: string;
    /** Claude only: the recorded rotation into `expectedToken` (`claudeResumeRotation`). Its process
     *  may name the rotation's token instead of `expectedToken`. */
    rotation?: ClaudeResumeRotation | null;
}, runtime: NativeRuntime): Promise<NativeProcessObservation | null>;
export declare function observeCodexPaneProcess(input: Parameters<typeof observeNativePaneProcess>[0]): Promise<CodexProcessObservation | null>;
export declare function verifyCodexPaneProcess(input: Parameters<typeof observeCodexPaneProcess>[0]): Promise<CodexProcessObservation | null>;
/** #1077 — the process OpenRig launched to resume `launchToken`, when it emitted a Claude hook:
 *  the pane's one foreground Claude, whose argv names that token, must be the hook process's parent
 *  or grandparent (Claude runs a hook through a shell, which may exec it), with no other Claude
 *  between. A `claude -p --resume` started from inside the seat inherits the launch environment,
 *  but its own hooks have that child as their nearest Claude. Null on anything unobserved. */
export declare function claudeHookFromLaunchedProcess(input: {
    target: string;
    tmux: {
        getPanePid(target: string): Promise<number | null>;
    };
    listProcesses?: NativeProcessLister;
    launchToken: string;
    hookPid: number;
}): Promise<ClaudeLaunchedProcess | null>;
/** #1077 — the launch path's own record of the process it started to resume `token`: the pane's one
 *  foreground Claude naming that token, stable across two samples, observed right after the launch
 *  succeeded. A rotation counts only for this process. Null when it cannot be observed. */
export declare function observeClaudeResumeLaunch(input: {
    target: string;
    tmux: {
        getPanePid(target: string): Promise<number | null>;
    };
    listProcesses?: NativeProcessLister;
    token: string;
}): Promise<ClaudeLaunchedProcess | null>;
export declare function observeClaudePaneProcess(input: Parameters<typeof observeNativePaneProcess>[0]): Promise<NativeProcessObservation | null>;
export declare function verifyClaudePaneProcess(input: Parameters<typeof observeNativePaneProcess>[0]): Promise<NativeProcessObservation | null>;
/** One foreground-runtime observation, without a conversation identity claim.
 * Sweep callers must compare two independent samples before using this as proof. */
export declare function observeClaudePaneRuntime(input: Omit<Parameters<typeof observeNativePaneProcess>[0], "expectedToken" | "requireResume">): Promise<NativeProcessObservation | null>;
/** Stable runtime occupancy only; never a substitute for exact resume proof. */
export declare function verifyClaudePaneRuntime(input: Parameters<typeof observeClaudePaneRuntime>[0]): Promise<NativeProcessObservation | null>;
/** The `ps` start time (lstart, local time) of the one stable Claude foreground
 * process. This makes no claim about its conversation token. */
export declare function observeClaudePaneStartedAt(input: Parameters<typeof observeClaudePaneRuntime>[0]): Promise<string | null>;
/** Whether the bound pane is a stable idle shell: in two samples the pane's own shell owns the foreground with
 * nothing else in its group, and it is the same shell both times. A missing, failed or changing listing is not idle:
 * a launch script still starting the runtime holds the foreground the same way a shell label would suggest. */
export declare function verifyPaneIdleShell(input: {
    target: string;
    tmux: {
        getPanePid(target: string): Promise<number | null>;
    };
    listProcesses?: NativeProcessLister;
}): Promise<boolean>;
export interface ClaudeDeliveryObservation {
    state: "verified" | "unknown" | "idle_shell" | "conflict";
    detail: string;
}
/** Ordinary delivery's uncertainty policy is separate from readiness/identity proof.
 *  `unknownKeepsIdle` (default true, for delivery): one unavailable sample can't erase a positive idle-shell refusal,
 *  because declining to type into an idle shell is safe. Launch passes false: there idle means "tell the person to
 *  restart", so it needs both samples idle with the same fingerprint, and a foreground starting between them reads
 *  unknown. */
export declare function observeClaudeDelivery(input: Parameters<typeof observeNativePaneProcess>[0], opts?: {
    unknownKeepsIdle?: boolean;
}): Promise<ClaudeDeliveryObservation>;
export {};
//# sourceMappingURL=native-process-lineage.d.ts.map