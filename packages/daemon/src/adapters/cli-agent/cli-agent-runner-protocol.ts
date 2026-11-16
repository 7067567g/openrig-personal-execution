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
import type { TaskBudgetConfig } from "./task-budget.js";

export type CliAgentRuntime = "opencode" | "dsh";

export const CLI_AGENT_READY_MARKER = "[cli-agent-runner] READY";
export const CLI_AGENT_EXITED_MARKER = "[cli-agent-runner] EXITED";
export const CLI_AGENT_ERROR_MARKER = "[cli-agent-runner] ERROR";
export const CLI_AGENT_RETRY_MARKER = "[cli-agent-runner] RETRY";
export const CLI_AGENT_BUDGET_MARKER = "[cli-agent-runner] BUDGET_EXHAUSTED";

export function sanitizeCliAgentSessionName(sessionName: string): string {
  return sessionName.replace(/[^A-Za-z0-9._@-]/g, "_");
}

export interface CliAgentSeatPaths {
  seatRoot: string;
  runnerStatePath: string;
}

export function cliAgentSeatPaths(stateRoot: string, sessionName: string): CliAgentSeatPaths {
  const seatRoot = nodePath.join(stateRoot, sanitizeCliAgentSessionName(sessionName));
  return {
    seatRoot,
    runnerStatePath: nodePath.join(seatRoot, "runner-state.json"),
  };
}

/** Per-seat token/cost snapshot written by the runner after each usage event. */
export function cliAgentUsagePath(stateRoot: string, sessionName: string): string {
  return nodePath.join(
    stateRoot,
    sanitizeCliAgentSessionName(sessionName),
    "usage.json",
  );
}

export interface CliAgentBudgetSidecar {
  enforced: true;
  /** Present only when the turn was terminated by a budget. */
  exhausted?: { dimension: string; limit: number; observed: number; at: string };
  retries_used: number;
  /** Which counters the runtime actually reported; `not_reported` must never read as enforced. */
  coverage: { steps: string; tool_calls: string; tokens: string };
  observed: { steps: number; tool_calls: number; tokens: number; wall_time_ms: number };
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
  exited?: { code: number | null; at: string };
}

export function buildPendingCliAgentRunnerState(
  launchId: string,
  updatedAt: string,
  prior: CliAgentRunnerState | null,
): CliAgentRunnerState {
  return {
    ready: false,
    launchId,
    sessionId: prior?.sessionId,
    updatedAt,
  };
}

export function parseCliAgentRunnerState(raw: string): CliAgentRunnerState | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const state = parsed as Record<string, unknown>;
    if (typeof state.ready !== "boolean" || typeof state.updatedAt !== "string") return null;
    return parsed as CliAgentRunnerState;
  } catch {
    return null;
  }
}

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

export function buildCliAgentRunnerCommand(opts: CliAgentRunnerLaunchOptions): string {
  const args = [
    "node",
    shellQuote(opts.runnerEntryPath),
    "--runtime", opts.runtime,
    "--session-name", shellQuote(opts.sessionName),
    "--state-root", shellQuote(opts.stateRoot),
    "--launch-id", shellQuote(opts.launchId),
    "--cwd", shellQuote(opts.cwd),
  ];
  if (opts.bin) args.push("--bin", shellQuote(opts.bin));
  if (opts.model) args.push("--model", shellQuote(opts.model));
  if (opts.agent) args.push("--agent", shellQuote(opts.agent));
  if (opts.resumeToken) args.push("--resume-token", shellQuote(opts.resumeToken));
  if (opts.profile) args.push("--profile", shellQuote(opts.profile));
  if (opts.budget?.enabled) {
    args.push(
      "--budget-max-wall-time-ms", String(opts.budget.maxWallTimeMs),
      "--budget-max-steps", String(opts.budget.maxSteps),
      "--budget-max-tool-calls", String(opts.budget.maxToolCalls),
      "--budget-max-tokens", String(opts.budget.maxTokens),
      "--budget-max-retries", String(opts.budget.maxRetries),
    );
  }
  return args.join(" ");
}

export function buildCliAgentInvocation(opts: {
  runtime: CliAgentRuntime;
  bin: string;
  text: string;
  sessionId?: string;
  model?: string;
  agent?: string;
  profile?: string;
}): { command: string; args: string[] } {
  if (opts.runtime === "opencode") {
    const args = ["run", "--format", "json"];
    if (opts.model) args.push("--model", opts.model);
    if (opts.agent) args.push("--agent", opts.agent);
    if (opts.sessionId) args.push("--session", opts.sessionId);
    args.push(opts.text);
    return { command: opts.bin, args };
  }

  const args = ["--profile", opts.profile ?? "headless", "--json"];
  if (opts.sessionId) args.push("--session-id", opts.sessionId);
  args.push(opts.text);
  return { command: opts.bin, args };
}
