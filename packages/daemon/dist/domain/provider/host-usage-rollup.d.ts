import type { ProviderKind, ProviderSignal, SignalWindow } from "./provider-types.js";
/** Nearing = the shipped default advisory threshold on the C3-carried percentage. */
export declare const NEARING_THRESHOLD_PERCENT = 80;
/** Same-window resets_at spread tolerated as sampling skew before it is a CONFLICT.
 *  Two seats on ONE account can read the same window seconds apart; two different
 *  accounts' reset schedules differ by far more than this. */
export declare const CONFLICTING_RESETS_EPSILON_MS = 120000;
export type HostUsageState = "ok" | "nearing" | "limited" | "explicit_unknown";
export interface HostUsageWindowFact {
    window: SignalWindow | "unknown";
    usedPercent?: number;
    resetsAt?: string;
    asOf: string;
    /** The contributing seat (topology identity, never an account identity). */
    seatSession?: string;
}
export interface HostUsageConflictAnomaly {
    kind: "conflicting_seat_windows";
    window: SignalWindow | "unknown";
    seats: string[];
    evidence: string;
    asOf: string;
}
export interface HostUsageRow {
    /** The reserved LOCAL host id — this daemon's own scope (MH aggregation is out of scope). */
    host: "local";
    provider: ProviderKind;
    state: HostUsageState;
    /** For `limited`: when the limit lifts, when the source carried it. Honest absence otherwise. */
    resetsAt?: string;
    /** (iii) exactly the C3-carried granularity — never normalized-away, never invented. */
    windows: HostUsageWindowFact[];
    provenance: {
        basis: "one_account_per_host_deployment_invariant";
        note: string;
    };
    anomalies: HostUsageConflictAnomaly[];
    /** Contributing evidence refs: seat sessions (C3) / labeled reactive events (C4). */
    evidenceSeats: string[];
    unknownReason?: string;
    asOf: string;
}
export interface HostUsageRollupInput {
    signals: ProviderSignal[];
    /** Deployment presence for codex (auth profiles on disk) — presence without a meter is an
     *  explicit unknown, never an omitted row (the blindside must be visible). */
    codexProfilesPresent: boolean;
    now: string;
}
export declare function rollupHostUsage(input: HostUsageRollupInput): HostUsageRow[];
//# sourceMappingURL=host-usage-rollup.d.ts.map