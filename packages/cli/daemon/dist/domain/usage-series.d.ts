import type { Database } from "better-sqlite3";
export interface UsageSeriesQuery {
    seatSession?: string;
    lane?: "context" | "provider_window";
    sinceIso?: string;
    untilIso?: string;
    limit?: number;
}
export interface UsageSeriesRow {
    id: number;
    lane: string;
    seatSession: string;
    nodeId: string | null;
    source: string | null;
    sampledAt: string | null;
    capturedAt: string;
    totalInputTokens: number | null;
    totalOutputTokens: number | null;
    usedPercentage: number | null;
    window: string | null;
    windowUsedPercent: number | null;
    resetsAt: string | null;
    /** Present once the cost columns exist: the sample's native session and Claude's cost estimate for it (history). */
    nativeSessionId?: string | null;
    clientCostEstimateUsd?: number | null;
}
/** Serve the RAW stored rows, oldest first. Bounds are absolute on captured_at
 *  (since inclusive-of-later, i.e. `>=`; until exclusive `<`). */
export declare function queryUsageSeries(db: Database, q: UsageSeriesQuery): UsageSeriesRow[];
export interface TopBurnQuery {
    windowHours: number;
    nowIso: string;
    topN?: number;
}
export interface WindowVelocity {
    window: string;
    usedPercentFirst: number | null;
    usedPercentLast: number | null;
    /** percent-points per hour over the actual sample span; null when unmeasurable */
    percentPerHour: number | null;
    resetsAt: string | null;
}
export interface SeatBurn {
    seatSession: string;
    /** summed POSITIVE consecutive token deltas over the actual sample span, per hour */
    tokensPerHour: number;
    /** total positive token delta inside the window */
    tokensDelta: number;
    /** count of negative total-token transitions within a counter history inside the window */
    resets: number;
    /** actual span between first and last in-window context sample, hours */
    spanHours: number;
    samples: number;
    windows: WindowVelocity[];
}
export interface UnknownSeat {
    seatSession: string;
    reason: "no_fresh_samples" | "insufficient_samples";
}
export interface TopBurnResult {
    windowHours: number;
    sinceIso: string;
    ranked: SeatBurn[];
    unknown: UnknownSeat[];
    /** total seats that ranked BEFORE the topN cap — truncation is never silent */
    totalRankedSeats: number;
}
/** The money question: top-N seats by token burn over the last H hours. */
export declare function computeTopBurn(db: Database, q: TopBurnQuery): TopBurnResult;
/** A Claude estimate older than this reads stale (it stays shown, as history). Matches context freshness. */
export declare const COST_STALE_AFTER_MS: number;
export declare const CODEX_NO_COST_NOTE = "no cost reported by the inspected method (Codex token_count events carry tokens only)";
/** DSH's runner reports token usage but no client-side cost; the view says so instead of showing $0. */
export declare const DSH_NO_COST_NOTE = "no cost reported by the inspected method (DSH runner reports tokens but no client cost estimate)";
export type OpencodeReportedCost = {
    seatSession: string;
    runtime: "opencode";
    status: "reported";
    kind: "client-side estimate";
    source: "OpenCode step_finish cost";
    costUsd: number;
    /** The estimate is cumulative for one native OpenCode session, since its last reset. */
    window: {
        nativeSessionId: string;
        since: string;
        asOf: string;
    };
    coverage: string;
    resets: number;
    stale: boolean;
    ageSeconds: number | null;
    tokens: {
        input: number | null;
        output: number | null;
    };
};
export type OpencodeAbsentCost = {
    seatSession: string;
    runtime: "opencode";
    status: "absent";
    reason: string;
    window: {
        nativeSessionId: string | null;
        asOf: string | null;
    };
    tokens: {
        input: number | null;
        output: number | null;
    };
};
export type DshSeatCost = {
    seatSession: string;
    runtime: "dsh";
    status: "no-cost-method";
    note: string;
    window: {
        nativeSessionId: string | null;
        asOf: string | null;
    };
    tokens: {
        input: number | null;
        output: number | null;
    };
};
export type SeatCost = {
    seatSession: string;
    runtime: "claude-code";
    status: "reported";
    kind: "client-side estimate";
    source: "Claude statusline cost.total_cost_usd";
    costUsd: number;
    /** The estimate is cumulative for one native Claude session, since its last reset. */
    window: {
        nativeSessionId: string;
        since: string;
        asOf: string;
    };
    coverage: string;
    resets: number;
    stale: boolean;
    ageSeconds: number | null;
    tokens: {
        input: number | null;
        output: number | null;
    };
} | {
    seatSession: string;
    runtime: "claude-code";
    status: "absent";
    reason: string;
    window: {
        nativeSessionId: string | null;
        asOf: string | null;
    };
    tokens: {
        input: number | null;
        output: number | null;
    };
} | {
    seatSession: string;
    runtime: "codex";
    status: "no-cost-method";
    note: string;
    window: {
        nativeSessionId: string | null;
        asOf: string | null;
    };
    tokens: {
        input: number | null;
        output: number | null;
    };
} | PiSeatCost | OpencodeReportedCost | OpencodeAbsentCost | DshSeatCost | {
    seatSession: string;
    runtime: null;
    status: "unknown";
    reason: string;
};
/** OPR.0.7.0.2 (Pi atom): a Pi seat's model-priced estimate from its persisted entries. */
export type PiSeatCost = {
    seatSession: string;
    runtime: "pi";
    status: "reported" | "absent";
    kind: "model-priced estimate";
    source: "Pi persisted session entries (usage.cost.total)";
    /** The occupant's own entries in this Pi session that carried a cost, summed; absent when none did. */
    costUsd?: number;
    reason?: string;
    window: {
        piSessionId: string;
        since: string | null;
        asOf: string | null;
    };
    coverage: string;
    /** Own entries by kind (all the usage-bearing kinds Pi records). */
    kinds: Record<"assistant" | "usage" | "tool_result" | "compaction" | "branch_summary", number>;
    entries: {
        own: number;
        /** Own entries Pi recorded without a cost: not counted as zero, and named. */
        ownWithoutCost: number;
        /** Own assistant entries that ended in an error or abort; their reported usage is included. */
        errorOrAborted: number;
        /** Entries a fork or branch copied in from the parent session: history, not this occupant's spend. */
        inherited: {
            count: number;
            costUsd: number | null;
        };
        /** Entries whose origin couldn't be told (the session header wasn't readable): kept apart from the total. */
        unknownOrigin: {
            count: number;
            costUsd: number | null;
        };
    };
    tokens: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
    };
    /** OPR.0.7.0.2 K4: OpenRouter's actual charge for this session's own requests, BESIDE the estimate (never added
     *  to it). Present once the store can hold charges. */
    providerCharge?: PiProviderChargeView;
};
export type PiProviderChargeView = {
    kind: "provider charge";
    source: "OpenRouter GET /api/v1/generation (data.total_cost, USD)";
    /** What the lookup covers and the case it can't observe. */
    coverage: string;
    /** reported: every covered request charged; partial: some; pending: lookups not finished; unavailable: none
     *  could be charged; none: no lookups recorded; not-applicable: no OpenRouter requests in this session. */
    status: "reported" | "partial" | "pending" | "unavailable" | "none" | "not-applicable";
    /** The charged requests' total, in USD; absent when none is charged. */
    costUsd?: number;
    /** Pi's estimate for exactly the charged requests, to read beside costUsd. */
    estimateForChargedUsd?: number | null;
    requests: {
        openRouter: number;
        covered: number;
        charged: number;
        pending: number;
        unavailable: {
            count: number;
            reasons: Record<string, number>;
        };
        notCovered: {
            count: number;
            reasons: Record<string, number>;
        };
    };
    /** Who was charged, as far as the lookups establish it: the generating credential's name (never a value) and
     *  the workspace(s) OpenRouter attributed the generations to. */
    accountContext: {
        credentialSources: string[];
        workspaceIds: string[];
        byokRequests: number;
    };
};
export declare const PI_COST_COVERAGE_WITH_CHARGE = "this Pi session's own persisted entries of every usage-bearing kind Pi records (assistant, usage, tool result, compaction, branch summary), each counted once; a model-priced estimate from catalog rates, not a provider charge (OpenRouter's actual charge, where established, is in providerCharge beside it, never added)";
export declare const PI_PROVIDER_CHARGE_COVERAGE = "OpenRouter requests Pi made through its openai-completions API with a recorded generation id, looked up with the key OpenRig forwarded only when the runner's observations before and after the request show that key as Pi's credential and no extension, credential-bearing models.json OpenRouter entry or unclassifiable credential source, and none has been seen, nor any reading failed, in the runner's life (models.json is read as Pi reads it, comments included). Conservatively excluded too: any settings.json package entry, and an explicit models.json apiKey even when it names OPENROUTER_API_KEY. Anthropic-messages requests, other credentials, inherited and unknown-origin entries are not looked up. Not observable: a credential Pi loads and drops between two of the runner's observations (an extension, a models.json entry, or a stored key added and removed within one gap), including runtime effects Pi keeps after it; Pi records no per-request credential";
export declare const PI_COST_COVERAGE = "this Pi session's own persisted entries of every usage-bearing kind Pi records (assistant, usage, tool result, compaction, branch summary), each counted once; a model-priced estimate from catalog rates, not a provider charge (an OpenRouter actual charge isn't correlated here)";
export interface CostViewResult {
    seats: SeatCost[];
    note: string;
}
export declare function computeCostView(db: Database, q: {
    nowIso: string;
    seatSession?: string;
    staleAfterMs?: number;
}): CostViewResult;
//# sourceMappingURL=usage-series.d.ts.map