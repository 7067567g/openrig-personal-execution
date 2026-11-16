import type { ProviderBinding, ProviderKind, ProviderSignal } from "./provider-types.js";
/** One provider-native usage window from the Codex app-server `account/rateLimits/read`. */
export interface CodexWindowReading {
    usedPercent: number;
    windowDurationMins: number;
    resetsAt: string;
}
/** Subset of the Codex app-server `account/rateLimits/read` response we consume. */
export interface CodexRateLimitReading {
    primary?: CodexWindowReading;
    secondary?: CodexWindowReading;
}
export interface CodexSignalInput {
    accountRef: string;
    /** Result of feature-probing the app-server generated schema for the rate-limit methods. */
    probe: {
        supported: boolean;
    };
    /** Present only when the probe was supported and a read actually returned. */
    reading?: CodexRateLimitReading;
    asOf: string;
    staleAfter?: string;
}
export declare const CODEX_UNKNOWN_REASON: {
    readonly probe_unsupported: "codex_app_server_unavailable";
    readonly empty_reading: "codex_read_returned_no_windows";
};
/**
 * Normalize a Codex app-server rate-limit read into `signals[]` rows.
 * - probe unsupported → one explicit `unknown` row.
 * - supported but no windows → one explicit `unknown` row (never fabricated zeros).
 * - supported with windows → one `provider_structured_read` row per provider-native window,
 *   preserving the native primary/secondary distinction.
 */
export declare function codexRateLimitSignals(input: CodexSignalInput): ProviderSignal[];
/** One Claude subscription window from the statusline `rate_limits` object. */
export interface ClaudeStatuslineWindow {
    usedPercent: number;
    resetsAt: string;
}
export interface ClaudeStatuslineReading {
    five_hour?: ClaudeStatuslineWindow;
    seven_day?: ClaudeStatuslineWindow;
}
export interface ClaudeSignalInput {
    /** Claude statusline carries session identity but no honest account identity (Option A). */
    seatSession: string;
    /** false = the statusline cache has not been written yet (before the first API response). */
    cachePresent: boolean;
    /** Present only when the cache exists and carried a rate_limits object. */
    reading?: ClaudeStatuslineReading;
    asOf: string;
    staleAfter?: string;
}
export declare const CLAUDE_UNKNOWN_REASON: {
    readonly no_statusline_cache_yet: "claude_no_statusline_cache_yet";
    readonly empty_reading: "claude_statusline_cache_had_no_windows";
};
/**
 * Normalize a Claude statusline `rate_limits` reading into `signals[]` rows.
 * - seat before first response (no cache) → explicit unknown row.
 * - seat with subscription windows → one `provider_statusline` row per window (five_hour, and
 *   seven_day normalized to "weekly"); a genuine 0 survives as 0.
 * - subscription with cache but no windows → explicit unknown row (never fabricated zeros).
 */
export declare function claudeStatuslineSignals(input: ClaudeSignalInput): ProviderSignal[];
export type ReactiveEventKind = "at_limit" | "stream_failure" | "stop_error";
export interface ReactiveEventInput {
    provider: ProviderKind;
    accountRef: string;
    kind: ReactiveEventKind;
    asOf: string;
    staleAfter: string;
}
export declare function reactiveEventSignal(input: ReactiveEventInput): ProviderSignal;
export interface UsageLimitPool {
    poolKey: string;
    provider: ProviderKind;
    seatSessions: string[];
    expiresAt: string;
    source: "provider-reset" | "config-fallback";
}
/**
 * Derive the provider/account pools whose fresh structured evidence says they are
 * exhausted. Claude statusline has no account ref, so its shipped one-account-per-host
 * invariant is one local pool. Codex uses the existing account binding. Nothing unknown,
 * stale, advisory, unbound, or already expired can create a park.
 */
export declare function deriveUsageLimitPools(input: {
    signals: ProviderSignal[];
    bindings: ProviderBinding[];
    now: Date;
    fallbackSeconds: number;
}): UsageLimitPool[];
//# sourceMappingURL=provider-signals.d.ts.map