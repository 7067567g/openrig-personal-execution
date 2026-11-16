// Shared, side-effect-free protocol for the OpenCode/DSH CLI agent runners.
//
// A runner is hosted in an OpenRig seat's tmux pane. It reads task text from
// stdin, invokes the runtime's headless CLI once per line, records the runtime
// session id in a sidecar, and prints a small marker stream for the pane.
//
// Keep this module free of daemon imports: the runner is a standalone node
// entry point and must not drag better-sqlite3/tmux into the pane process.
import nodePath from "node:path";
import { shellQuote } from "../shell-quote.js";
export const CLI_AGENT_READY_MARKER = "[cli-agent-runner] READY";
export const CLI_AGENT_EXITED_MARKER = "[cli-agent-runner] EXITED";
export const CLI_AGENT_ERROR_MARKER = "[cli-agent-runner] ERROR";
export const CLI_AGENT_RETRY_MARKER = "[cli-agent-runner] RETRY";
export const CLI_AGENT_BUDGET_MARKER = "[cli-agent-runner] BUDGET_EXHAUSTED";
export function sanitizeCliAgentSessionName(sessionName) {
    return sessionName.replace(/[^A-Za-z0-9._@-]/g, "_");
}
export function cliAgentSeatPaths(stateRoot, sessionName) {
    const seatRoot = nodePath.join(stateRoot, sanitizeCliAgentSessionName(sessionName));
    return {
        seatRoot,
        runnerStatePath: nodePath.join(seatRoot, "runner-state.json"),
    };
}
export function buildPendingCliAgentRunnerState(launchId, updatedAt, prior) {
    return {
        ready: false,
        launchId,
        sessionId: prior?.sessionId,
        updatedAt,
    };
}
export function parseCliAgentRunnerState(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            return null;
        const state = parsed;
        if (typeof state.ready !== "boolean" || typeof state.updatedAt !== "string")
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
export function buildCliAgentRunnerCommand(opts) {
    const args = [
        "node",
        shellQuote(opts.runnerEntryPath),
        "--runtime", opts.runtime,
        "--session-name", shellQuote(opts.sessionName),
        "--state-root", shellQuote(opts.stateRoot),
        "--launch-id", shellQuote(opts.launchId),
        "--cwd", shellQuote(opts.cwd),
    ];
    if (opts.bin)
        args.push("--bin", shellQuote(opts.bin));
    if (opts.model)
        args.push("--model", shellQuote(opts.model));
    if (opts.agent)
        args.push("--agent", shellQuote(opts.agent));
    if (opts.resumeToken)
        args.push("--resume-token", shellQuote(opts.resumeToken));
    if (opts.profile)
        args.push("--profile", shellQuote(opts.profile));
    if (opts.budget?.enabled) {
        args.push("--budget-max-wall-time-ms", String(opts.budget.maxWallTimeMs), "--budget-max-steps", String(opts.budget.maxSteps), "--budget-max-tool-calls", String(opts.budget.maxToolCalls), "--budget-max-tokens", String(opts.budget.maxTokens), "--budget-max-retries", String(opts.budget.maxRetries));
    }
    return args.join(" ");
}
export function buildCliAgentInvocation(opts) {
    if (opts.runtime === "opencode") {
        const args = ["run", "--format", "json"];
        if (opts.model)
            args.push("--model", opts.model);
        if (opts.agent)
            args.push("--agent", opts.agent);
        if (opts.sessionId)
            args.push("--session", opts.sessionId);
        args.push(opts.text);
        return { command: opts.bin, args };
    }
    const args = ["--profile", opts.profile ?? "headless", "--json"];
    if (opts.sessionId)
        args.push("--session-id", opts.sessionId);
    args.push(opts.text);
    return { command: opts.bin, args };
}
//# sourceMappingURL=cli-agent-runner-protocol.js.map