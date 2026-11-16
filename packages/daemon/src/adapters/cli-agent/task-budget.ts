// Per-turn task budgets — pure folding/limit logic for the pane-hosted
// cli-agent runners. Side-effect free: the runner owns timers, child kills and
// sidecar writes; this module only answers "is this turn over budget, and on
// which dimension".
//
// Default posture: DISABLED. Only the presence of `--budget-*` args (which the
// adapter emits only when budget.enabled is true) turns enforcement on, so an
// existing seat's command line and behaviour are byte-identical by default.
//
// Honest coverage: the shared-web DSH shim emits only session/status/final, so
// it reports no tool calls, steps or token usage. A configured cap over an
// event stream that never carried the evidence must read `not_reported`, not
// "enforced" (and not "0 observed, therefore fine"). The daemon-facing docs
// state this; the runner records it in the sidecar.

export const TASK_BUDGET_DIMENSIONS = ["wall_time", "steps", "tool_calls", "tokens"] as const;
export type TaskBudgetDimension = (typeof TASK_BUDGET_DIMENSIONS)[number];

export interface TaskBudgetConfig {
  enabled: boolean;
  /** 0 = unlimited. */
  maxWallTimeMs: number;
  /** 0 = unlimited. */
  maxSteps: number;
  /** 0 = unlimited. */
  maxToolCalls: number;
  /** 0 = unlimited. */
  maxTokens: number;
  /** Extra attempts after the first, for NON-budget failures. 0 = no retry. */
  maxRetries: number;
}

export const DEFAULT_TASK_BUDGET_CONFIG: TaskBudgetConfig = {
  enabled: false,
  maxWallTimeMs: 1_800_000,
  maxSteps: 200,
  maxToolCalls: 100,
  maxTokens: 0,
  maxRetries: 0,
};

export interface TaskBudgetState {
  config: TaskBudgetConfig;
  startedAtMs: number;
  steps: number;
  toolCalls: number;
  tokens: number;
  retries: number;
  attempts: number;
  /** Evidence flags: did the runtime ever emit the event class we count? */
  sawStepEvent: boolean;
  sawStepStart: boolean;
  sawToolEvent: boolean;
  sawUsageEvent: boolean;
}

export interface TaskBudgetBreach {
  dimension: TaskBudgetDimension;
  limit: number;
  observed: number;
}

export type BudgetCoverage = "reported" | "not_reported";

export interface TaskBudgetCoverageView {
  steps: BudgetCoverage;
  tool_calls: BudgetCoverage;
  tokens: BudgetCoverage;
}

function normalizeLimit(value: number): number {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0 ? value : 0;
}

export function normalizeTaskBudgetConfig(raw: Partial<TaskBudgetConfig>): TaskBudgetConfig {
  return {
    enabled: raw.enabled === true,
    maxWallTimeMs: normalizeLimit(raw.maxWallTimeMs ?? 0),
    maxSteps: normalizeLimit(raw.maxSteps ?? 0),
    maxToolCalls: normalizeLimit(raw.maxToolCalls ?? 0),
    maxTokens: normalizeLimit(raw.maxTokens ?? 0),
    maxRetries: Number.isFinite(raw.maxRetries) && Number.isInteger(raw.maxRetries) && (raw.maxRetries ?? 0) > 0
      ? (raw.maxRetries as number)
      : 0,
  };
}

export function createTaskBudgetState(config: TaskBudgetConfig, startedAtMs: number): TaskBudgetState {
  return {
    config: normalizeTaskBudgetConfig(config),
    startedAtMs,
    steps: 0,
    toolCalls: 0,
    tokens: 0,
    retries: 0,
    attempts: 1,
    sawStepEvent: false,
    sawStepStart: false,
    sawToolEvent: false,
    sawUsageEvent: false,
  };
}

function typeOf(event: Record<string, unknown>): string {
  const type = event["type"];
  return typeof type === "string" ? type : "";
}

function phaseOf(event: Record<string, unknown>): string {
  const phase = event["phase"];
  return typeof phase === "string" ? phase : "";
}

function isStepStart(event: Record<string, unknown>): boolean {
  return typeOf(event) === "step_start" || typeOf(event) === "step/start"
    || (typeOf(event) === "status" && (phaseOf(event) === "step_start" || phaseOf(event) === "step/start"));
}

function isStepEnd(event: Record<string, unknown>): boolean {
  return typeOf(event) === "step_end" || typeOf(event) === "step/end"
    || (typeOf(event) === "status" && (phaseOf(event) === "step_end" || phaseOf(event) === "step/end"));
}

function isToolCall(event: Record<string, unknown>): boolean {
  const type = typeOf(event);
  return type === "tool_call" || type === "tool-call" || type === "tool_use" || type === "tool/use";
}

/** Token usage is read from `step_end` / `usage`-shaped events only. Counting a
 *  cumulative `final.usage` as well would double-count a runtime that emits
 *  per-step usage; a runtime that emits usage ONLY on final stays honestly
 *  `not_reported` instead of being mis-counted. */
function isUsageEvent(event: Record<string, unknown>): boolean {
  const type = typeOf(event);
  return type === "step_end" || type === "step/end" || type === "usage" || type === "usage_update";
}

function numberField(value: Record<string, unknown>, names: readonly string[]): number | undefined {
  for (const name of names) {
    const candidate = value[name];
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0) return candidate;
  }
  return undefined;
}

function usageTotal(usage: Record<string, unknown>): number | undefined {
  const total = numberField(usage, ["total_tokens", "totalTokens", "total"]);
  if (total !== undefined) return total;
  const input = numberField(usage, ["input_tokens", "inputTokens", "prompt_tokens", "promptTokens"]) ?? 0;
  const output = numberField(usage, ["output_tokens", "outputTokens", "completion_tokens", "completionTokens"]) ?? 0;
  return input + output > 0 ? input + output : undefined;
}

function readUsageTokens(event: Record<string, unknown>): number | undefined {
  const candidates: unknown[] = [];
  // An explicit usage event may carry the counts at its top level.
  if (typeOf(event) === "usage" || typeOf(event) === "usage_update") candidates.push(event);
  candidates.push(event["usage"]);
  const data = event["data"];
  if (data && typeof data === "object" && !Array.isArray(data)) candidates.push((data as Record<string, unknown>)["usage"]);
  const message = event["message"];
  if (message && typeof message === "object" && !Array.isArray(message)) candidates.push((message as Record<string, unknown>)["usage"]);
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const total = usageTotal(candidate as Record<string, unknown>);
      if (total !== undefined) return total;
    }
  }
  return undefined;
}

function breachFor(state: TaskBudgetState, dimension: TaskBudgetDimension, limit: number, observed: number): TaskBudgetBreach | null {
  if (limit <= 0) return null;
  return observed >= limit ? { dimension, limit, observed } : null;
}

/** Counts breach on the NEXT unit: max_steps=2 allows two steps and terminates
 *  when a third arrives. Wall time is a deadline, so reaching it is a breach. */
function countBreachFor(state: TaskBudgetState, dimension: TaskBudgetDimension, limit: number, observed: number): TaskBudgetBreach | null {
  if (limit <= 0) return null;
  return observed > limit ? { dimension, limit, observed } : null;
}

/**
 * Fold one runtime event and return the FIRST budget breach it caused, or null.
 * Counting is monotonic across retries within one task.
 */
export function observeTaskBudgetEvent(state: TaskBudgetState, event: Record<string, unknown>): TaskBudgetBreach | null {
  if (!state.config.enabled) return null;

  if (isStepStart(event)) {
    state.sawStepEvent = true;
    state.sawStepStart = true;
    state.steps += 1;
  } else if (isStepEnd(event)) {
    state.sawStepEvent = true;
    // Start events already counted this step; end-only streams count here.
    if (!state.sawStepStart) state.steps += 1;
  }

  if (isToolCall(event)) {
    state.sawToolEvent = true;
    state.toolCalls += 1;
  }

  if (isUsageEvent(event)) {
    const tokens = readUsageTokens(event);
    if (tokens !== undefined) {
      state.sawUsageEvent = true;
      state.tokens += tokens;
    }
  }

  return checkTaskBudget(state, state.startedAtMs);
}

/** Wall clock first, then the event-dimension counters in a fixed order. */
export function checkTaskBudget(state: TaskBudgetState, nowMs: number): TaskBudgetBreach | null {
  if (!state.config.enabled) return null;
  const wall = breachFor(state, "wall_time", state.config.maxWallTimeMs, Math.max(0, nowMs - state.startedAtMs));
  if (wall) return wall;
  return countBreachFor(state, "steps", state.config.maxSteps, state.steps)
    ?? countBreachFor(state, "tool_calls", state.config.maxToolCalls, state.toolCalls)
    ?? countBreachFor(state, "tokens", state.config.maxTokens, state.tokens);}

export function taskBudgetCoverage(state: TaskBudgetState): TaskBudgetCoverageView {
  return {
    steps: state.sawStepEvent || state.steps > 0 ? "reported" : "not_reported",
    tool_calls: state.sawToolEvent || state.toolCalls > 0 ? "reported" : "not_reported",
    tokens: state.sawUsageEvent || state.tokens > 0 ? "reported" : "not_reported",
  };
}

/** One human-readable line for the pane marker and the sidecar's lastError. */
export function formatTaskBudgetBreach(breach: TaskBudgetBreach): string {
  const observed = breach.dimension === "wall_time"
    ? (breach.observed < 1000 ? `${breach.observed}ms` : `${Math.round(breach.observed / 1000)}s`)
    : String(breach.observed);
  return `task budget exhausted: ${breach.dimension} limit=${breach.limit} observed=${observed}`;
}

/** Retries are only for non-budget failures and are capped by maxRetries. */
export function canRetryTask(state: TaskBudgetState, nowMs: number): boolean {
  if (!state.config.enabled) return false;
  if (state.retries >= state.config.maxRetries) return false;
  return checkTaskBudget(state, nowMs) === null;
}

export function recordTaskRetry(state: TaskBudgetState): number {
  state.retries += 1;
  state.attempts += 1;
  return state.retries;
}
