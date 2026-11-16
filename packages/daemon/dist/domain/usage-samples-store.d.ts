import type { Database } from "better-sqlite3";
import type { ProviderSignal } from "./provider/provider-types.js";
export interface ContextSampleInput {
    nodeId: string;
    seatSession: string;
    source: string | null;
    sampledAt: string | null;
    totalInputTokens: number | null;
    totalOutputTokens: number | null;
    usedPercentage: number | null;
    /** The native session the sample belongs to (Claude session id, Codex thread id). */
    nativeSessionId?: string | null;
    /** Claude's cumulative client-side cost estimate for that session; null when none is reported. */
    clientCostEstimateUsd?: number | null;
}
export interface ProviderWindowSampleInput {
    seatSession: string;
    window: "five_hour" | "weekly";
    usedPercent: number | null;
    resetsAt: string | null;
    asOf: string;
}
/** Whether migration 105's cost columns exist (a database built from 062 alone has none). */
export declare function hasClientCostColumns(db: Database): boolean;
export declare class UsageSamplesStore {
    private readonly db;
    private costColumns;
    constructor(db: Database);
    private withCost;
    /** Append the context-lane sample IFF it advanced past the seat's latest row. */
    appendContextSample(s: ContextSampleInput, capturedAt: string): boolean;
    /** Append the provider-window sample IFF it advanced past the seat's latest row for that window. */
    appendProviderWindowSample(s: ProviderWindowSampleInput, capturedAt: string): boolean;
}
/** Map the read model's statusline signals to window-sample inputs. Only the two
 *  normalized subscription windows ride the series; rows without a seat identity
 *  or an asOf stamp are skipped (nothing is fabricated — the Option-A bar). */
export declare function providerWindowSamplesFromSignals(signals: ProviderSignal[]): ProviderWindowSampleInput[];
//# sourceMappingURL=usage-samples-store.d.ts.map