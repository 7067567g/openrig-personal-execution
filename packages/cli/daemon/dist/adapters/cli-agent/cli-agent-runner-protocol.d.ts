import type { TaskBudgetConfig } from "./task-budget.js";
export type CliAgentRuntime = "opencode" | "dsh";
export declare const CLI_AGENT_READY_MARKER = "[cli-agent-runner] READY";
export declare const CLI_AGENT_EXITED_MARKER = "[cli-agent-runner] EXITED";
export declare const CLI_AGENT_ERROR_MARKER = "[cli-agent-runner] ERROR";
export declare const CLI_AGENT_RETRY_MARKER = "[cli-agent-runner] RETRY";
export declare const CLI_AGENT_BUDGET_MARKER = "[cli-agent-runner] BUDGET_EXHAUSTED";
export declare function sanitizeCliAgentSessionName(sessionName: string): string;
export interface CliAgentSeatPaths {
    seatRoot: string;
    runnerStatePath: string;
}
export declare function cliAgentSeatPaths(stateRoot: string, sessionName: string): CliAgentSeatPaths;
export interface CliAgentBudgetSidecar {
    enforced: true;
    /** Present only when the turn was terminated by a budget. */
    exhausted?: {
        dimension: string;
        limit: number;
        observed: number;
        at: string;
    };
    retries_used: number;
    /** Which counters the runtime actually reported; `not_reported` must never read as enforced. */
    coverage: {
        steps: string;
        tool_calls: string;
        tokens: string;
    };
    observed: {
        steps: number;
        tool_calls: number;
        tokens: number;
        wall_time_ms: number;
    };
}
export interface CliAgentRunnerState {
    ready: boolean;
    launchId?: string;
    /** Runtime-native session id (OpenCode ses_… / DSH session-…). */
    sessionId?: string;
    /** Node this state belongs to; prevents a new rig from auto-resuming another node's work. */
    nodeId?: string;
    updatedAt: string;
    lastResultText?: string;
    lastError?: string;
    /** Per-turn budget outcome; absent when budgets are disabled (the default). */
    budget?: CliAgentBudgetSidecar;
    exited?: {
        code: number | null;
        at: string;
    };
}
export declare function buildPendingCliAgentRunnerState(launchId: string, updatedAt: string, prior: CliAgentRunnerState | null): CliAgentRunnerState;
export declare function parseCliAgentRunnerState(raw: string): CliAgentRunnerState | null;
export interface CliAgentRunnerLaunchOptions {
    runtime: CliAgentRuntime;
    runnerEntryPath: string;
    sessionName: string;
    stateRoot: string;
    cwd: string;
    launchId: string;
    /** Explicit CLI executable. Defaults are resolved by the runner's PATH. */
    bin?: string;
    model?: string;
    agent?: string;
    resumeToken?: string;
    /** DSH profile; defaults to headless. */
    profile?: string;
    /** Per-turn budget. Omitted when disabled (the default), so the command line is unchanged. */
    budget?: TaskBudgetConfig;
}
export declare function buildCliAgentRunnerCommand(opts: CliAgentRunnerLaunchOptions): string;
export declare function buildCliAgentInvocation(opts: {
    runtime: CliAgentRuntime;
    bin: string;
    text: string;
    sessionId?: string;
    model?: string;
    agent?: string;
    profile?: string;
}): {
    command: string;
    args: string[];
};
//# sourceMappingURL=cli-agent-runner-protocol.d.ts.map