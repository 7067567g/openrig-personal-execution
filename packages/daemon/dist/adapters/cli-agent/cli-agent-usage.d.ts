export type CliAgentUsageRuntime = "opencode" | "dsh";
export interface CliAgentUsageTotals {
    input: number;
    output: number;
    reasoning: number;
    cacheRead: number;
    cacheWrite: number;
    costUsd: number | null;
}
export interface CliAgentUsageLastStep {
    at: string;
    input: number;
    output: number;
    reasoning: number;
    cacheRead: number;
    cacheWrite: number;
    costUsd: number | null;
}
export interface CliAgentUsageSidecar {
    schemaVersion: 1;
    runtime: CliAgentUsageRuntime;
    sessionName: string;
    sessionId?: string;
    sampledAt: string;
    steps: number;
    totals: CliAgentUsageTotals;
    lastStep: CliAgentUsageLastStep | null;
    /** Last accepted usage-event key, persisted so a runner restart can still dedupe a replayed tail. */
    lastEventId?: string;
}
export interface CliAgentUsageState {
    runtime: CliAgentUsageRuntime;
    sessionName: string;
    sessionId?: string;
    sampledAt: string;
    steps: number;
    totals: CliAgentUsageTotals;
    lastStep: CliAgentUsageLastStep | null;
    /** Dedup key of the last accepted usage event; persisted in the sidecar. */
    lastEventId?: string;
}
export declare const CLI_AGENT_USAGE_SCHEMA_VERSION: 1;
export declare function createCliAgentUsageState(runtime: CliAgentUsageRuntime, sessionName: string, sessionId?: string, prior?: CliAgentUsageSidecar | null): CliAgentUsageState;
/**
 * Point the usage state at a runtime-native session id.
 *
 * A runner may be reused across native sessions (for example when the seat is
 * fresh-primed). Cumulative totals belong to one native session, so a change
 * resets the fold instead of letting the new session inherit the old session's
 * cost/token window. Returns true when totals were reset (caller should persist).
 */
export declare function setCliAgentUsageSession(state: CliAgentUsageState, nextSessionId: string | undefined, nowIso: string): boolean;
/**
 * Fold one runtime event. Returns `true` only when a usage event advanced the
 * totals (so the runner knows to persist); anything else leaves the state
 * untouched.
 */
export declare function observeCliAgentUsageEvent(state: CliAgentUsageState, event: Record<string, unknown>, nowIso: string): boolean;
export declare function cliAgentUsageSnapshot(state: CliAgentUsageState, nowIso: string): CliAgentUsageSidecar;
/** Strict reader for the persisted sidecar: bad JSON or a missing field → null. */
export declare function parseCliAgentUsageSidecar(raw: string): CliAgentUsageSidecar | null;
//# sourceMappingURL=cli-agent-usage.d.ts.map