import type { UsageReadOutcome } from "./usage-windows.js";
export type ClaudeAuthFailureReason = "binary_not_found" | "auth_status_failed" | "not_logged_in" | "not_subscription_login";
/** The `auth status` fields this reader uses; nothing else is kept. */
export interface ClaudeAuthFacts {
    loggedIn: boolean;
    authMethod: string | null;
    email: string | null;
    orgId: string | null;
    /** Labels only: never part of a key. */
    orgName: string | null;
    subscriptionType: string | null;
}
export type ClaudeAuthAnswer = {
    auth: ClaudeAuthFacts;
};
export type ClaudeAuthReader = () => Promise<UsageReadOutcome<ClaudeAuthAnswer>>;
export interface ClaudeAuthReaderOptions {
    launchPath?: string;
    home?: string;
    claudeConfigDir?: string;
    timeoutMs?: number;
    /** How long a stopped process group gets after TERM before KILL (and after KILL before giving up). */
    graceMs?: number;
    now?: () => string;
}
export declare const CLAUDE_AUTH_STATUS_TIMEOUT_MS = 10000;
export declare const GRACE_MS = 1000;
/** The `claude` executable on the reader's own PATH, as an absolute path, or null. */
export declare function resolveClaudeExecutable(env: NodeJS.ProcessEnv): string | null;
/** The child environment: the seat's HOME/CLAUDE_CONFIG_DIR/PATH, never TMUX, TMUX_PANE or seat variables. */
export declare function claudeAuthReaderEnv(options: ClaudeAuthReaderOptions, base?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
export declare function claudeAuthStatusReader(options?: ClaudeAuthReaderOptions): ClaudeAuthReader;
//# sourceMappingURL=claude-auth-status-reader.d.ts.map