export type CodexUsageFailureReason = "binary_not_found" | "spawn_failed" | "rpc_error" | "unrecognized_shape" | "timeout" | "child_exited" | "output_too_large";
/** The two raw answers, as the app-server sent them. Normalizing is the windows module's job. */
export type CodexUsageReadOutcome = {
    ok: true;
    observedAt: string;
    account: unknown;
    rateLimits: unknown;
} | {
    ok: false;
    at: string;
    reason: CodexUsageFailureReason;
    detail: string;
};
export type CodexUsageReader = () => Promise<CodexUsageReadOutcome>;
export interface CodexUsageReaderOptions {
    /** The PATH, HOME and CODEX_HOME a seat session gets. */
    launchPath?: string;
    home?: string;
    codexHome?: string;
    /** Answers must arrive within this; then stdin EOF, and TERM/KILL of the reader's process group. */
    deadlineMs?: number;
    graceMs?: number;
    maxOutputBytes?: number;
    now?: () => string;
}
/** The app-server, with plugins and apps switched off for this read only (as `codex-network-default.ts`). */
export declare const CODEX_USAGE_READER_ARGS: string[];
/** Native reads take 25–35 s (Ops' readers); the refresh is bounded by the upper end. */
export declare const CODEX_USAGE_READ_DEADLINE_MS = 35000;
/** How long the reader's process group gets at each stop step (and for the reap) once the read ends. */
export declare const CODEX_USAGE_READ_GRACE_MS = 2000;
export declare function codexUsageReader(options?: CodexUsageReaderOptions): CodexUsageReader;
//# sourceMappingURL=codex-usage-reader.d.ts.map