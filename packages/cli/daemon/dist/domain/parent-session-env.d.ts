export declare const PARENT_SESSION_ENV_KEYS: readonly ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_EXECPATH", "CLAUDE_CODE_MESSAGING_SOCKET", "CLAUDE_CODE_MESSAGING_TOKEN", "CLAUDE_CODE_CHILD_SESSION", "CLAUDE_CODE_SESSION_ATTENDED", "CLAUDE_PID", "HERDR_ENV", "HERDR_PANE_ID", "HERDR_TAB_ID", "HERDR_WORKSPACE_ID", "HERDR_STARTUP_CWD"];
/** The parent-session names present in `env`. CLAUDE_EFFORT is user
 * configuration unless CLAUDECODE shows a parent Claude Code session set it. */
export declare function parentSessionEnvKeys(env: Readonly<Record<string, string | undefined>>): string[];
/** Remove the parent session's identity from `env` in place; nothing else is
 * set or changed. Returns the removed names. */
export declare function removeParentSessionEnv(env: Record<string, string | undefined>): string[];
//# sourceMappingURL=parent-session-env.d.ts.map