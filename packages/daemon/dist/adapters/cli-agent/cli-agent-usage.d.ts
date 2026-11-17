export type CliAgentUsageRuntime = "opencode" | "dsh";
/** A token counter is null when the runtime did not report it. A reported zero
 * stays 0; missing and zero are deliberately different values. */
export interface CliAgentUsageTotals {
    input: number | null;
    output: number | null;
    reasoning: number | null;
    cacheRead: number | null;
    cacheWrite: number | null;
    /** Aggregate token aliases (`total_tokens` / `totalTokens` / `total`) when
     * the runtime reports a total without a component split. */
    total: number | null;
    costUsd: number | null;
}
export interface CliAgentUsageLastStep {
    at: string;
    input: number | null;
    output: number | null;
    reasoning: number | null;
    cacheRead: number | null;
    cacheWrite: number | null;
    total: number | null;
    costUsd: number | null;
}
export interface CliAgentUsageSidecar {
    schemaVersion: 1;
    runtime: CliAgentUsageRuntime;
    sessionName: string;
    sessionId?: string;
    /** Per-seat occupant tenure that produced this file. A same-name successor
     * has a different generation and must not resume the predecessor's totals. */
    occupantGeneration?: string;
    sampledAt: string;
    steps: number;
    totals: CliAgentUsageTotals;
    lastStep: CliAgentUsageLastStep | null;
    /** Last accepted usage-event key (kept for old-sidecar compatibility). */
    lastEventId?: string;
    /** Bounded replay window of accepted usage-event keys. */
    recentEventIds?: string[];
}
export interface CliAgentUsageState {
    runtime: CliAgentUsageRuntime;
    sessionName: string;
    sessionId?: string;
    occupantGeneration?: string;
    sampledAt: string;
    steps: number;
    totals: CliAgentUsageTotals;
    lastStep: CliAgentUsageLastStep | null;
    /** Last accepted usage-event key; persisted in the sidecar for compatibility. */
    lastEventId?: string;
    /** Bounded replay window of accepted usage-event keys. */
    recentEventIds: string[];
}
export declare const CLI_AGENT_USAGE_SCHEMA_VERSION: 1;
/** Enough IDs to absorb a reconnect replay while keeping the sidecar bounded. */
export declare const CLI_AGENT_USAGE_DEDUPE_LIMIT = 64;
export declare function createCliAgentUsageState(runtime: CliAgentUsageRuntime, sessionName: string, sessionId?: string, prior?: CliAgentUsageSidecar | null, occupantGeneration?: string | undefined): CliAgentUsageState;
/**
 * Point the usage state at a runtime-native session id.
 *
 * A runner may be reused across native sessions (for example when the seat is
 * fresh-primed). Cumulative totals belong to one native session, so a change
 * resets the fold instead of letting the new session inherit the old session's
 * cost/token window. Returns true when totals were reset (caller should persist).
 */
export declare function setCliAgentUsageSession(state: CliAgentUsageState, nextSessionId: string | undefined, nowIso: string): boolean;
export declare function observeCliAgentUsageEvent(state: CliAgentUsageState, event: Record<string, unknown>, nowIso: string): boolean;
export declare function cliAgentUsageSnapshot(state: CliAgentUsageState, nowIso: string): CliAgentUsageSidecar;
/** Strict reader for the persisted sidecar: bad JSON or a missing field → null. */
export declare function parseCliAgentUsageSidecar(raw: string): CliAgentUsageSidecar | null;
//# sourceMappingURL=cli-agent-usage.d.ts.map