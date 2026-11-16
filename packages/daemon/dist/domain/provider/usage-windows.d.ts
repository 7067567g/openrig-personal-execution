import type { ProviderKind, ProviderUsageAllowance, UsageRefreshOutcome, UsageWindowRow } from "./provider-types.js";
/** A reading is too old to claim current capacity after this (Ops' openrig.subscription-usage.v1 rule). */
export declare const USAGE_FRESH_FOR_MS: number;
/** An observation up to this far in the future is clock skew within tolerance (same rule). */
export declare const USAGE_CLOCK_TOLERANCE_MS = 60000;
/** Unresolved observations can't be matched to earlier ones, so each read adds its own rows. Keep those
 *  from the most recent few reads: enough to compare the latest with the two before it, and bounded
 *  because nothing else ever removes them. */
export declare const UNRESOLVED_READS_KEPT = 3;
export interface UsageReadWindow {
    /** The provider-native window name. */
    window: string;
    durationMins: number | null;
    usedPercent: number | null;
    resetsAt: string | null;
}
export interface UsageReading<I> {
    identity: I;
    windows: UsageReadWindow[];
    limitEvidence: string | null;
    observedAt: string;
}
/** A reader's outcome: the raw answers on success (normalizing is the provider spec's job), or a named failure. */
export type UsageReadOutcome<R> = ({
    ok: true;
    observedAt: string;
} & R) | {
    ok: false;
    at: string;
    reason: string;
    detail: string;
};
export interface UsageWindowsSpec<I extends {
    source: string;
}, R> {
    provider: ProviderKind;
    sourceKind: ProviderUsageAllowance["source"]["kind"];
    read: () => Promise<UsageReadOutcome<R>>;
    normalize: (answer: R & {
        observedAt: string;
    }) => {
        ok: true;
        readings: Array<UsageReading<I>>;
    } | {
        ok: false;
        detail: string;
    };
    /** The replacement key of a resolved identity; null when unresolved (never matched or replaced). */
    key: (identity: I) => string | null;
    now?: () => string;
}
export interface UsageRefreshResult {
    refresh: UsageRefreshOutcome & {
        coalesced: boolean;
    };
}
/** Freshness is aged from the window's own observation, never from the time of the request. A row a later
 *  read superseded is stale whatever its age. */
export declare function usageFreshness(observedAt: string, now: string, failedAfter: {
    at: string;
} | null, superseded?: boolean): Pick<UsageWindowRow, "freshness" | "freshnessReason">;
/** Level of one window as of its observation. Absent data is never nearing or exhausted. */
export declare function usageLevel(window: UsageReadWindow, limitEvidence: string | null, now: string): Pick<UsageWindowRow, "level" | "levelReason">;
export declare const UNRESOLVED_NOTE = "identity unresolved: not matched to, merged with or replacing any other row";
export declare const UNRESOLVED_EARLIER_NOTE = "identity unresolved: from an earlier read, possibly this same login; not matched to, merged with or replacing any other row";
export declare class UsageWindows<I extends {
    source: string;
}, R> {
    private readonly spec;
    private readonly now;
    private readonly startedAt;
    private readonly readings;
    /** Unresolved observations, grouped by read, newest last; at most UNRESOLVED_READS_KEPT reads. */
    private unresolved;
    private unresolvedDropped;
    private lastRefresh;
    private inflight;
    constructor(spec: UsageWindowsSpec<I, R>);
    /** One bounded read. A refresh asked for while one runs joins it; one asked for after it ends reads again. */
    refresh(): Promise<UsageRefreshResult>;
    private runRead;
    private recordFailure;
    /** The served rows. Reads memory only: it never starts a native read. */
    project(now: string): ProviderUsageAllowance[];
}
//# sourceMappingURL=usage-windows.d.ts.map