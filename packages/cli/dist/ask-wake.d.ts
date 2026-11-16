export interface WakeRunResult {
    stdout: string;
    stderr: string;
    code: number | null;
    timedOut: boolean;
}
/** Runs a headless one-shot command with a bounded timeout. Injectable for tests. */
export type WakeRunner = (cmd: string, args: string[], opts: {
    timeoutMs: number;
}) => Promise<WakeRunResult>;
export interface WakeDeps {
    runner: WakeRunner;
    /** Locate the session file for a size advisory (pin 5). Optional. */
    fileLocator?: (token: string) => {
        path: string;
        sizeBytes: number;
    } | null;
}
export interface WakeArgs {
    question: string;
    token: string;
    runtime: "claude" | "codex";
    timeoutMs?: number;
}
export interface WakeOutcome {
    ran: boolean;
    answer?: string;
    timedOut?: boolean;
    /** true when the wake process exited non-zero (bad token / missing binary /
     *  auth fail) — an honest failure, NOT a successful empty answer. */
    failed?: boolean;
    code?: number;
    message?: string;
    advisory?: string;
}
/** Default bounded wake timeout — long enough for a real recall, short enough
 *  that a hang surfaces instead of blocking forever (founder datapoint: ~minutes
 *  on a 635 MB session file). */
export declare const DEFAULT_WAKE_TIMEOUT_MS = 180000;
/**
 * Build the HEADLESS one-shot resume command. `claude -p --resume <token>`
 * prints the answer and EXITS — the wake target is the session FILE, so the
 * process goes back to cold with no lingering process (pin 2/3, mini-PRD A).
 * codex uses `codex exec resume` (adapter-honest; session-file size lags the host).
 */
export declare function buildWakeCommand(runtime: "claude" | "codex", token: string, question: string): {
    cmd: string;
    args: string[];
};
/** Default runner: execFile with a hard timeout. Resolving means the child
 *  exited (back-to-cold) — we never retain a handle. */
export declare const defaultWakeRunner: WakeRunner;
/** Default file locator for the size advisory: scan ~/.claude/projects/<cwd>/<token>.jsonl. */
export declare function defaultWakeFileLocator(token: string): {
    path: string;
    sizeBytes: number;
} | null;
/**
 * L3 — wake a session by its resume token, ask one (possibly batched) question,
 * capture the snapshot answer, and let the process go back to cold. EXECUTES —
 * the only level with runtime cost/side effects; it runs ONLY when explicitly
 * invoked (never an implicit escalation from a failed L1/L2 search). Bounded
 * timeout + large-file advisory — never a silent hang.
 */
export declare function runWake(deps: WakeDeps, args: WakeArgs): Promise<WakeOutcome>;
//# sourceMappingURL=ask-wake.d.ts.map