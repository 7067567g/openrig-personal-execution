export interface ProviderLimitConfig {
    enabled: boolean;
    /** Cap on live seats per provider/model key. 0 = unlimited. */
    maxActiveSeats: number;
    /** New seat starts per minute per key. 0 = unlimited. */
    launchesPerMinute: number;
    /** Token bucket capacity. 0 inserts one token at a time (no burst). */
    burst: number;
    /** How long an over-limit start waits. 0 = forever. */
    queueTimeoutSeconds: number;
}
export declare const DEFAULT_PROVIDER_LIMIT_CONFIG: ProviderLimitConfig;
export type ProviderLimitEnforcedBy = "config" | "not_enforced";
export type ProviderLimitReason = "disabled" | "no_limit" | "config_error";
export interface ProviderLimitLease {
    ok: true;
    leaseId: string;
    provider: string;
    model: string;
    enforcedBy: ProviderLimitEnforcedBy;
    reason?: ProviderLimitReason;
    waitedMs: number;
}
export interface ProviderLimitTimeout {
    ok: false;
    code: "provider_rate_limited";
    message: string;
    provider: string;
    model: string;
    waitedMs: number;
    retryAfterMs: number;
}
export type ProviderLimitResult = ProviderLimitLease | ProviderLimitTimeout;
export interface ProviderLimitSnapshot {
    enabled: boolean;
    enforcedBy: ProviderLimitEnforcedBy;
    reason?: ProviderLimitReason;
    limits: {
        maxActiveSeats: number;
        launchesPerMinute: number;
        burst: number;
        queueTimeoutSeconds: number;
    };
    current: {
        total: number;
        byKey: Record<string, number>;
    };
    peak: {
        total: number;
        byKey: Record<string, number>;
        queued: number;
    };
    queued: {
        total: number;
        byKey: Record<string, number>;
    };
    byKey: Record<string, {
        provider: string;
        model: string;
        live: number;
        pending: number;
        current: number;
        peak: number;
        queued: number;
        countErrors: number;
    }>;
}
export interface ProviderRateLimitOptions {
    /** Read fresh per call so `rig config set` applies to the next start. */
    readConfig?: () => ProviderLimitConfig;
    /** Live seats for this key, excluding launches this module has admitted. */
    countLive?: (input: {
        provider: string;
        model: string;
    }) => number;
    now?: () => number;
    /** How often a waiter re-checks the live count. */
    recheckMs?: number;
}
export declare function providerForRuntime(runtime: string | null | undefined): string;
export declare function runtimesForProvider(provider: string): readonly string[];
export declare class ProviderRateLimiter {
    private readonly readConfig;
    private readonly countLive;
    private readonly now;
    private readonly recheckMs;
    private readonly leases;
    private readonly pending;
    private readonly buckets;
    private readonly waiters;
    private readonly stats;
    private readonly observed;
    private readonly known;
    private waitSeq;
    private leaseSeq;
    private pumpTimer;
    private peakQueued;
    private peakCurrentTotal;
    constructor(options?: ProviderRateLimitOptions);
    /**
     * Admit one seat start for `provider`/`model`. Resolves when a slot and a
     * token are available, or with `provider_rate_limited` on timeout.
     */
    acquire(input: {
        provider: string;
        model?: string | null;
    }): Promise<ProviderLimitResult>;
    /** Release a slot taken by a successful acquire. Idempotent; no-op for a
     *  `not_enforced` lease. */
    release(leaseId: string): void;
    snapshot(): ProviderLimitSnapshot;
    /** Config read + classify. A throwing reader is a fail-open config_error. */
    private config;
    private immediate;
    private reserve;
    private canAdmitNow;
    private liveCount;
    private bucket;
    private availableTokens;
    private takeToken;
    private retryAfterMs;
    private updatePeak;
    private queuedTotal;
    private removeWaiter;
    private startPump;
    private stopPumpIfIdle;
    /** Admit as many queued waiters as the current config allows, FIFO per key. */
    private pumpAll;
}
//# sourceMappingURL=provider-rate-limit.d.ts.map