import { describe, expect, it } from "vitest";
import {
  DEFAULT_TASK_BUDGET_CONFIG,
  canRetryTask,
  checkTaskBudget,
  createTaskBudgetState,
  formatTaskBudgetBreach,
  normalizeTaskBudgetConfig,
  observeTaskBudgetEvent,
  recordTaskRetry,
  taskBudgetCoverage,
  type TaskBudgetConfig,
} from "../src/adapters/cli-agent/task-budget.js";

function budget(patch: Partial<TaskBudgetConfig> = {}): TaskBudgetConfig {
  return normalizeTaskBudgetConfig({ enabled: true, ...patch });
}

describe("task budget folding", () => {
  it("is inert when disabled (the default)", () => {
    const state = createTaskBudgetState(DEFAULT_TASK_BUDGET_CONFIG, 0);
    expect(DEFAULT_TASK_BUDGET_CONFIG.enabled).toBe(false);
    for (let i = 0; i < 10; i += 1) {
      expect(observeTaskBudgetEvent(state, { type: "tool_call" })).toBeNull();
    }
    expect(checkTaskBudget(state, 10_000_000)).toBeNull();
    expect(state.toolCalls).toBe(0);
    expect(canRetryTask(state, 0)).toBe(false);
  });

  it("counts steps once across step_start/step_end pairs and on end-only streams", () => {
    const state = createTaskBudgetState(budget(), 0);
    observeTaskBudgetEvent(state, { type: "step_start" });
    observeTaskBudgetEvent(state, { type: "step_end" });
    observeTaskBudgetEvent(state, { type: "step/start" });
    observeTaskBudgetEvent(state, { type: "step/end" });
    expect(state.steps).toBe(2);

    const endOnly = createTaskBudgetState(budget(), 0);
    observeTaskBudgetEvent(endOnly, { type: "step_end" });
    observeTaskBudgetEvent(endOnly, { type: "step_end" });
    expect(endOnly.steps).toBe(2);

    const statusShaped = createTaskBudgetState(budget(), 0);
    observeTaskBudgetEvent(statusShaped, { type: "status", phase: "step_end" });
    expect(statusShaped.steps).toBe(1);
  });

  it("counts tool_call / tool_use and breaches only after the limit is exceeded", () => {
    const state = createTaskBudgetState(budget({ maxToolCalls: 2 }), 0);
    expect(observeTaskBudgetEvent(state, { type: "tool_call", tool: "bash" })).toBeNull();
    expect(observeTaskBudgetEvent(state, { type: "tool_use", part: { tool: "edit" } })).toBeNull();
    expect(observeTaskBudgetEvent(state, { type: "tool_call", tool: "read" })).toEqual({
      dimension: "tool_calls",
      limit: 2,
      observed: 3,
    });
    expect(state.toolCalls).toBe(3);
    expect(formatTaskBudgetBreach({ dimension: "tool_calls", limit: 2, observed: 3 }))
      .toBe("task budget exhausted: tool_calls limit=2 observed=3");
  });

  it("counts steps and breaches on the step after max_steps", () => {
    const state = createTaskBudgetState(budget({ maxSteps: 1 }), 0);
    expect(observeTaskBudgetEvent(state, { type: "step_start" })).toBeNull();
    expect(observeTaskBudgetEvent(state, { type: "step_start" })).toEqual({
      dimension: "steps",
      limit: 1,
      observed: 2,
    });
  });

  it("sums token usage from step_end (snake and camel) and a usage event", () => {
    const state = createTaskBudgetState(budget({ maxTokens: 100 }), 0);
    expect(observeTaskBudgetEvent(state, {
      type: "step_end",
      usage: { input_tokens: 20, output_tokens: 10 },
    })).toBeNull();
    expect(observeTaskBudgetEvent(state, {
      type: "step_end",
      usage: { inputTokens: 30, outputTokens: 25 },
    })).toBeNull();
    expect(state.tokens).toBe(85);
    expect(observeTaskBudgetEvent(state, { type: "usage", totalTokens: 40 })).toEqual({
      dimension: "tokens",
      limit: 100,
      observed: 125,
    });
    expect(taskBudgetCoverage(state).tokens).toBe("reported");
  });

  it("does not double count a cumulative final.usage when per-step usage was reported", () => {
    const state = createTaskBudgetState(budget(), 0);
    observeTaskBudgetEvent(state, { type: "step_end", usage: { total_tokens: 10 } });
    observeTaskBudgetEvent(state, { type: "final", usage: { total_tokens: 10 } });
    expect(state.tokens).toBe(10);
  });

  it("treats a limit of 0 as unlimited", () => {
    const state = createTaskBudgetState(budget({ maxSteps: 0, maxToolCalls: 0, maxTokens: 0, maxWallTimeMs: 0 }), 0);
    for (let i = 0; i < 500; i += 1) {
      observeTaskBudgetEvent(state, { type: "tool_call" });
      observeTaskBudgetEvent(state, { type: "step_start" });
    }
    expect(checkTaskBudget(state, 10_000_000)).toBeNull();
    expect(state.steps).toBe(500);
  });

  it("checks wall time as a deadline, not a per-event counter", () => {
    const state = createTaskBudgetState(budget({ maxWallTimeMs: 1000 }), 5_000);
    expect(checkTaskBudget(state, 5_999)).toBeNull();
    expect(checkTaskBudget(state, 6_000)).toEqual({ dimension: "wall_time", limit: 1000, observed: 1000 });
    expect(formatTaskBudgetBreach({ dimension: "wall_time", limit: 1000, observed: 2500 }))
      .toBe("task budget exhausted: wall_time limit=1000 observed=3s");
  });

  it("reports coverage honestly: absent event classes are not_reported", () => {
    const state = createTaskBudgetState(budget({ maxToolCalls: 5, maxTokens: 5 }), 0);
    expect(taskBudgetCoverage(state)).toEqual({
      steps: "not_reported",
      tool_calls: "not_reported",
      tokens: "not_reported",
    });
    observeTaskBudgetEvent(state, { type: "tool_call" });
    expect(taskBudgetCoverage(state).tool_calls).toBe("reported");
    expect(taskBudgetCoverage(state).tokens).toBe("not_reported");
  });

  it("caps non-budget retries and refuses a retry once a limit is already hit", () => {
    const state = createTaskBudgetState(budget({ maxRetries: 2, maxSteps: 1 }), 0);
    expect(canRetryTask(state, 0)).toBe(true);
    expect(recordTaskRetry(state)).toBe(1);
    expect(state.attempts).toBe(2);
    expect(recordTaskRetry(state)).toBe(2);
    expect(canRetryTask(state, 0)).toBe(false);

    const exhausted = createTaskBudgetState(budget({ maxRetries: 5, maxSteps: 1 }), 0);
    observeTaskBudgetEvent(exhausted, { type: "step_start" });
    observeTaskBudgetEvent(exhausted, { type: "step_start" });
    expect(canRetryTask(exhausted, 0)).toBe(false);
  });

  it("normalizes negative/NaN/invalid values to 0 / disabled", () => {
    expect(normalizeTaskBudgetConfig({ enabled: false, maxSteps: -3, maxTokens: Number.NaN })).toMatchObject({
      enabled: false,
      maxSteps: 0,
      maxTokens: 0,
      maxRetries: 0,
    });
    expect(normalizeTaskBudgetConfig({ enabled: true, maxRetries: -1 }).maxRetries).toBe(0);
  });
});
