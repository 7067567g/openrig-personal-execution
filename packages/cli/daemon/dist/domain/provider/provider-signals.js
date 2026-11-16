// Slice-04 (OPR.0.5.0.4) — signals[] normalization (the §2 detection design, encoded).
// Authority: locked packet 3ffa3c22 IMPLEMENTATION-PRD §2 + the 2026-07-31 RESEARCH verdict.
// Honesty rules enforced here: feature-probe-negative and empty reads become EXPLICIT
// `unknown` rows (never silent zeros, never missing rows); only a real structured read is
// `allow_switch_decision` (BR-2).
import { signalEligibleForAutomation } from "./provider-policy.js";
export const CODEX_UNKNOWN_REASON = {
    probe_unsupported: "codex_app_server_unavailable",
    empty_reading: "codex_read_returned_no_windows",
};
function codexUnknownSignal(accountRef, asOf, unknownReason, supportsNotification, staleAfter) {
    return {
        provider: "codex",
        accountRef,
        sourceClass: "unknown",
        authority: "unknown",
        asOf,
        staleAfter,
        unknownReason,
        // Unknown DATA must not erase KNOWN transport capability: when the app-server is present
        // (supported-but-empty) `account/rateLimits/updated` still exists, so the notification
        // capability is true; only an absent app-server (probe unsupported) is false.
        supportsNotification,
        automationUse: "do_not_automate",
        // usedPercent / resetsAt / window deliberately OMITTED — an unknown row never carries a
        // fabricated zero (the BR-2 silent-zero trap). A genuine 0 only ever comes from a real read.
    };
}
/**
 * Normalize a Codex app-server rate-limit read into `signals[]` rows.
 * - probe unsupported → one explicit `unknown` row.
 * - supported but no windows → one explicit `unknown` row (never fabricated zeros).
 * - supported with windows → one `provider_structured_read` row per provider-native window,
 *   preserving the native primary/secondary distinction.
 */
export function codexRateLimitSignals(input) {
    const { accountRef, probe, reading, asOf, staleAfter } = input;
    if (!probe.supported) {
        // App-server absent → no notification transport.
        return [codexUnknownSignal(accountRef, asOf, CODEX_UNKNOWN_REASON.probe_unsupported, false, staleAfter)];
    }
    const windows = [
        ["primary", reading?.primary],
        ["secondary", reading?.secondary],
    ];
    const rows = [];
    for (const [window, w] of windows) {
        if (!w)
            continue;
        rows.push({
            provider: "codex",
            accountRef,
            sourceClass: "provider_structured_read",
            authority: "account_cross_device",
            window,
            usedPercent: w.usedPercent,
            resetsAt: w.resetsAt,
            windowDurationMins: w.windowDurationMins,
            asOf,
            staleAfter,
            supportsNotification: true, // Codex app-server carries account/rateLimits/updated
            automationUse: "allow_switch_decision",
        });
    }
    if (rows.length === 0) {
        // App-server present but returned no windows → unknown DATA, but the transport capability
        // (account/rateLimits/updated) is still KNOWN present → supportsNotification stays true.
        return [codexUnknownSignal(accountRef, asOf, CODEX_UNKNOWN_REASON.empty_reading, true, staleAfter)];
    }
    return rows;
}
export const CLAUDE_UNKNOWN_REASON = {
    no_statusline_cache_yet: "claude_no_statusline_cache_yet",
    empty_reading: "claude_statusline_cache_had_no_windows",
};
function claudeUnknownSignal(seatSession, asOf, unknownReason, staleAfter) {
    return {
        provider: "claude",
        seatSession,
        sourceClass: "unknown",
        authority: "unknown",
        asOf,
        staleAfter,
        unknownReason,
        supportsNotification: false, // Claude statusline has no push transport
        automationUse: "do_not_automate",
        // usedPercent / resetsAt / window OMITTED — never a fabricated zero.
    };
}
/**
 * Normalize a Claude statusline `rate_limits` reading into `signals[]` rows.
 * - seat before first response (no cache) → explicit unknown row.
 * - seat with subscription windows → one `provider_statusline` row per window (five_hour, and
 *   seven_day normalized to "weekly"); a genuine 0 survives as 0.
 * - subscription with cache but no windows → explicit unknown row (never fabricated zeros).
 */
export function claudeStatuslineSignals(input) {
    const { seatSession, cachePresent, reading, asOf, staleAfter } = input;
    if (!cachePresent) {
        return [claudeUnknownSignal(seatSession, asOf, CLAUDE_UNKNOWN_REASON.no_statusline_cache_yet, staleAfter)];
    }
    const windows = [
        ["five_hour", reading?.five_hour],
        ["weekly", reading?.seven_day],
    ];
    const rows = [];
    for (const [window, w] of windows) {
        if (!w)
            continue;
        rows.push({
            provider: "claude",
            seatSession,
            sourceClass: "provider_statusline",
            authority: "account_cross_device", // Claude.ai Pro/Max subscription windows are account-level
            window,
            usedPercent: w.usedPercent,
            resetsAt: w.resetsAt,
            asOf,
            staleAfter,
            supportsNotification: false, // no push unless OpenRig later supplies a cache-update event
            automationUse: "allow_switch_decision",
        });
    }
    if (rows.length === 0) {
        return [claudeUnknownSignal(seatSession, asOf, CLAUDE_UNKNOWN_REASON.empty_reading, staleAfter)];
    }
    return rows;
}
export function reactiveEventSignal(input) {
    return {
        provider: input.provider,
        accountRef: input.accountRef,
        sourceClass: "provider_event",
        authority: "reactive_error",
        asOf: input.asOf,
        staleAfter: input.staleAfter,
        // supportsNotification is OMITTED: it describes a per-account transport capability (true for
        // Codex account/rateLimits/updated, false/unknown for Claude statusline). A generic reactive
        // event does not establish that capability — hard-coding false would fabricate it.
        // At-limit exhaustion is an actionable switch trigger; stream/stop errors are advisory.
        automationUse: input.kind === "at_limit" ? "allow_switch_decision" : "advisory_only",
        // No usedPercent — a reactive event is exhaustion evidence, not a remaining meter.
    };
}
/**
 * Derive the provider/account pools whose fresh structured evidence says they are
 * exhausted. Claude statusline has no account ref, so its shipped one-account-per-host
 * invariant is one local pool. Codex uses the existing account binding. Nothing unknown,
 * stale, advisory, unbound, or already expired can create a park.
 */
export function deriveUsageLimitPools(input) {
    const nowMs = input.now.getTime();
    if (!Number.isFinite(nowMs))
        return [];
    const eligible = input.signals.filter((signal) => signalEligibleForAutomation(signal, input.now.toISOString()).eligible);
    const exhausted = eligible.filter((signal) => (typeof signal.usedPercent === "number" && signal.usedPercent >= 100) ||
        (signal.sourceClass === "provider_event" && signal.authority === "reactive_error"));
    const pools = new Map();
    for (const signal of exhausted) {
        const poolKey = signal.provider === "claude"
            ? "claude:local"
            : signal.accountRef
                ? `codex:${signal.accountRef}`
                : null;
        if (!poolKey)
            continue;
        const pool = pools.get(poolKey) ?? { provider: signal.provider, signals: [] };
        pool.signals.push(signal);
        pools.set(poolKey, pool);
    }
    const result = [];
    for (const [poolKey, pool] of pools) {
        const statedResets = pool.signals
            .map((signal) => Date.parse(signal.resetsAt ?? ""))
            .filter((value) => Number.isFinite(value) && value > nowMs);
        const fallbackResets = pool.provider === "codex"
            ? pool.signals
                .map((signal) => Date.parse(signal.asOf) + input.fallbackSeconds * 1000)
                .filter((value) => Number.isFinite(value) && value > nowMs)
            : [];
        const expiryMs = statedResets.length > 0
            ? Math.max(...statedResets)
            : fallbackResets.length > 0
                ? Math.max(...fallbackResets)
                : null;
        if (expiryMs === null)
            continue;
        const seatSessions = pool.provider === "claude"
            ? input.signals
                .filter((signal) => signal.provider === "claude" && typeof signal.seatSession === "string")
                .map((signal) => signal.seatSession)
            : input.bindings
                .filter((binding) => binding.accountId === pool.signals[0].accountRef)
                .map((binding) => binding.seatSession);
        const uniqueSeats = [...new Set(seatSessions)].sort();
        if (uniqueSeats.length === 0)
            continue;
        result.push({
            poolKey,
            provider: pool.provider,
            seatSessions: uniqueSeats,
            expiresAt: new Date(expiryMs).toISOString(),
            source: statedResets.length > 0 ? "provider-reset" : "config-fallback",
        });
    }
    return result.sort((a, b) => a.poolKey.localeCompare(b.poolKey));
}
//# sourceMappingURL=provider-signals.js.map