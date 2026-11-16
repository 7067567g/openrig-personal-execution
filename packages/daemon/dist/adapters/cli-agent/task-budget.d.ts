export declare const TASK_BUDGET_DIMENSIONS: readonly ["wall_time", "steps", "tool_calls", "tokens"];
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
export declare const DEFAULT_TASK_BUDGET_CONFIG: TaskBudgetConfig;
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
export declare function normalizeTaskBudgetConfig(raw: Partial<TaskBudgetConfig>): TaskBudgetConfig;
export declare function createTaskBudgetState(config: TaskBudgetConfig, startedAtMs: number): TaskBudgetState;
/**
 * Fold one runtime event and return the FIRST budget breach it caused, or null.
 * Counting is monotonic across retries within one task.
 */
export declare function observeTaskBudgetEvent(state: TaskBudgetState, event: Record<string, unknown>): TaskBudgetBreach | null;
/** Wall clock first, then the event-dimension counters in a fixed order. */
export declare function checkTaskBudget(state: TaskBudgetState, nowMs: number): TaskBudgetBreach | null;
export declare function taskBudgetCoverage(state: TaskBudgetState): TaskBudgetCoverageView;
/** One human-readable line for the pane marker and the sidecar's lastError. */
export declare function formatTaskBudgetBreach(breach: TaskBudgetBreach): string;
/** Retries are only for non-budget failures and are capped by maxRetries. */
export declare function canRetryTask(state: TaskBudgetState, nowMs: number): boolean;
export declare function recordTaskRetry(state: TaskBudgetState): number;
//# sourceMappingURL=task-budget.d.ts.map