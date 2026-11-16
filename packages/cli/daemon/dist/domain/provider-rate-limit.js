// Provider/model seat-start limiting — the daemon-side provider consumer gate.
//
// Why seat starts: OpenRig does not proxy provider API calls. The daemon's
// provider domain only reads usage/account metadata; the processes that call
// Anthropic/OpenAI/DeepSeek are the seats themselves. The daemon's one lever on
// provider load is therefore how many seats of a given provider/model are alive
// and how fast new ones start. This module bounds exactly that:
//
//   - semaphore: live seats for a provider/model key, counted from the session
//     registry plus launches this process has admitted but not yet registered;
//   - token bucket: new starts per minute for the same key, with a burst.
//
// It is NOT an API-call proxy or a per-request limiter. Bounding individual
// provider requests would need a runner↔daemon lease protocol or a proxy (see
// the round's DECISIONS entry).
//
// Default posture: DISABLED. `enabled=false` admits immediately, reports
// `not_enforced`, queries no database and keeps no counters. An enabled config
// with both numeric caps at 0 is the explicit "no limit" state.
//
// Queueing is in-memory, like launch admission: a daemon restart drops waiters.
// A live-count read failure fails OPEN (admits) rather than bricking launches;
// the failure is counted in the snapshot.
export const DEFAULT_PROVIDER_LIMIT_CONFIG = {
    enabled: false,
    maxActiveSeats: 0,
    launchesPerMinute: 0,
    burst: 4,
    queueTimeoutSeconds: 30,
};
/** Runtime → provider family. A known runtime keeps its family; anything else
 *  is its own key (never invented into a family). */
const PROVIDER_RUNTIMES = {
    claude: ["claude-code"],
    codex: ["codex"],
    deepseek: ["dsh"],
    pi: ["pi"],
    omp: ["omp"],
};
export function providerForRuntime(runtime) {
    switch (runtime) {
        case "claude-code": return "claude";
        case "codex": return "codex";
        case "dsh": return "deepseek";
        case "pi": return "pi";
        case "omp": return "omp";
        default: return runtime || "unknown";
    }
}
export function runtimesForProvider(provider) {
    return PROVIDER_RUNTIMES[provider] ?? [provider];
}
function keyOf(provider, model) {
    return `${provider}\u0000${model}`;
}
function displayKey(provider, model) {
    return `${provider}/${model || "default"}`;
}
function normalizeConfig(raw) {
    const int = (value, fallback) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
    return {
        enabled: raw?.enabled === true,
        maxActiveSeats: int(raw?.maxActiveSeats, 0),
        launchesPerMinute: int(raw?.launchesPerMinute, 0),
        burst: int(raw?.burst, 0),
        queueTimeoutSeconds: int(raw?.queueTimeoutSeconds, 0),
    };
}
function enforced(cfg) {
    return cfg.enabled && (cfg.maxActiveSeats > 0 || cfg.launchesPerMinute > 0);
}
export class ProviderRateLimiter {
    readConfig;
    countLive;
    now;
    recheckMs;
    leases = new Map();
    pending = new Map();
    buckets = new Map();
    waiters = new Map();
    stats = new Map();
    observed = new Map();
    known = new Set();
    waitSeq = 0;
    leaseSeq = 0;
    pumpTimer = null;
    peakQueued = 0;
    peakCurrentTotal = 0;
    constructor(options = {}) {
        this.readConfig = options.readConfig ?? (() => DEFAULT_PROVIDER_LIMIT_CONFIG);
        this.countLive = options.countLive ?? (() => 0);
        this.now = options.now ?? (() => Date.now());
        this.recheckMs = Math.max(1, options.recheckMs ?? 250);
    }
    /**
     * Admit one seat start for `provider`/`model`. Resolves when a slot and a
     * token are available, or with `provider_rate_limited` on timeout.
     */
    async acquire(input) {
        const startedAt = this.now();
        const provider = input.provider;
        const model = input.model ?? "";
        const key = keyOf(provider, model);
        const cfg = this.config();
        if (cfg.reason) {
            return this.immediate(provider, model, startedAt, cfg.reason);
        }
        const limits = cfg.config;
        if (!limits.enabled) {
            return this.immediate(provider, model, startedAt, "disabled");
        }
        if (!enforced(limits)) {
            return this.immediate(provider, model, startedAt, "no_limit");
        }
        this.known.add(key);
        if (this.canAdmitNow(key, provider, model, limits)) {
            return this.reserve(key, provider, model, startedAt);
        }
        return new Promise((resolve) => {
            const waiter = {
                id: `wait-${++this.waitSeq}`,
                key,
                provider,
                model,
                enqueuedAt: startedAt,
                settled: false,
                timer: null,
                resolve,
            };
            const queue = this.waiters.get(key) ?? [];
            queue.push(waiter);
            this.waiters.set(key, queue);
            this.peakQueued = Math.max(this.peakQueued, this.queuedTotal());
            if (limits.queueTimeoutSeconds > 0) {
                waiter.timer = setTimeout(() => {
                    if (waiter.settled)
                        return;
                    this.removeWaiter(waiter);
                    waiter.settled = true;
                    const waitedMs = this.now() - startedAt;
                    resolve({
                        ok: false,
                        code: "provider_rate_limited",
                        message: `provider start limit: ${displayKey(provider, model)} waited ${waitedMs}ms and no slot freed. Nothing was started.`,
                        provider,
                        model,
                        waitedMs,
                        retryAfterMs: this.retryAfterMs(key, limits),
                    });
                    this.stopPumpIfIdle();
                }, limits.queueTimeoutSeconds * 1000);
            }
            this.startPump();
        });
    }
    /** Release a slot taken by a successful acquire. Idempotent; no-op for a
     *  `not_enforced` lease. */
    release(leaseId) {
        const lease = this.leases.get(leaseId);
        if (!lease)
            return;
        this.leases.delete(leaseId);
        this.pending.set(lease.key, Math.max(0, (this.pending.get(lease.key) ?? 0) - 1));
        this.pumpAll();
    }
    snapshot() {
        const cfg = this.config();
        const limits = cfg.config ?? DEFAULT_PROVIDER_LIMIT_CONFIG;
        const isEnforced = !cfg.reason && enforced(limits);
        const byKey = {};
        const currentByKey = {};
        const peakByKey = {};
        const queuedByKey = {};
        const keys = new Set([...this.known, ...this.waiters.keys()]);
        let currentTotal = 0;
        let queuedTotal = 0;
        for (const key of keys) {
            const [provider = "", model = ""] = key.split("\u0000");
            const live = isEnforced ? this.liveCount(key, provider, model) : 0;
            const pending = this.pending.get(key) ?? 0;
            const current = live + pending;
            const stats = this.stats.get(key) ?? { peak: 0, countErrors: 0 };
            stats.peak = Math.max(stats.peak, current);
            this.stats.set(key, stats);
            const queued = this.waiters.get(key)?.length ?? 0;
            const display = displayKey(provider, model);
            byKey[display] = {
                provider, model, live, pending, current,
                peak: stats.peak, queued, countErrors: stats.countErrors,
            };
            currentByKey[display] = current;
            peakByKey[display] = stats.peak;
            queuedByKey[display] = queued;
            currentTotal += current;
            queuedTotal += queued;
        }
        this.peakCurrentTotal = Math.max(this.peakCurrentTotal, currentTotal);
        return {
            enabled: cfg.config?.enabled === true,
            enforcedBy: isEnforced ? "config" : "not_enforced",
            ...(isEnforced ? {} : { reason: cfg.reason ?? (!limits.enabled ? "disabled" : "no_limit") }),
            limits: {
                maxActiveSeats: limits.maxActiveSeats,
                launchesPerMinute: limits.launchesPerMinute,
                burst: limits.burst,
                queueTimeoutSeconds: limits.queueTimeoutSeconds,
            },
            current: { total: currentTotal, byKey: currentByKey },
            peak: { total: this.peakCurrentTotal, byKey: peakByKey, queued: this.peakQueued },
            queued: { total: queuedTotal, byKey: queuedByKey },
            byKey,
        };
    }
    /** Config read + classify. A throwing reader is a fail-open config_error. */
    config() {
        try {
            return { config: normalizeConfig(this.readConfig()) };
        }
        catch {
            return { reason: "config_error" };
        }
    }
    immediate(provider, model, startedAt, reason) {
        return {
            ok: true,
            leaseId: `lease-${++this.leaseSeq}`,
            provider,
            model,
            enforcedBy: "not_enforced",
            reason,
            waitedMs: Math.max(0, this.now() - startedAt),
        };
    }
    reserve(key, provider, model, startedAt) {
        const cfg = this.config().config ?? DEFAULT_PROVIDER_LIMIT_CONFIG;
        this.pending.set(key, (this.pending.get(key) ?? 0) + 1);
        if (cfg.launchesPerMinute > 0)
            this.takeToken(key, cfg);
        const lease = {
            ok: true,
            leaseId: `lease-${++this.leaseSeq}`,
            provider,
            model,
            enforcedBy: "config",
            waitedMs: Math.max(0, this.now() - startedAt),
        };
        this.leases.set(lease.leaseId, { key, provider, model });
        this.updatePeak(key);
        return lease;
    }
    canAdmitNow(key, provider, model, cfg) {
        if (cfg.maxActiveSeats > 0) {
            const live = this.liveCount(key, provider, model);
            const pending = this.pending.get(key) ?? 0;
            if (live + pending >= cfg.maxActiveSeats)
                return false;
        }
        if (cfg.launchesPerMinute > 0 && this.availableTokens(key, cfg) < 1)
            return false;
        return true;
    }
    liveCount(key, provider, model) {
        try {
            const value = Number(this.countLive({ provider, model }));
            if (Number.isFinite(value) && value >= 0) {
                this.observed.set(key, Math.floor(value));
                return Math.floor(value);
            }
        }
        catch { /* fail open below */ }
        const stats = this.stats.get(key) ?? { peak: 0, countErrors: 0 };
        stats.countErrors += 1;
        this.stats.set(key, stats);
        // Fail OPEN: a broken reader must not brick launches.
        return this.observed.get(key) ?? 0;
    }
    bucket(key, cfg) {
        const now = this.now();
        const capacity = Math.max(1, cfg.burst);
        const bucket = this.buckets.get(key) ?? { tokens: capacity, at: now };
        if (cfg.launchesPerMinute > 0) {
            const elapsed = Math.max(0, now - bucket.at);
            bucket.tokens = Math.min(capacity, bucket.tokens + (elapsed * cfg.launchesPerMinute) / 60_000);
        }
        bucket.at = now;
        this.buckets.set(key, bucket);
        return bucket;
    }
    availableTokens(key, cfg) {
        return this.bucket(key, cfg).tokens;
    }
    takeToken(key, cfg) {
        const bucket = this.bucket(key, cfg);
        bucket.tokens = Math.max(0, bucket.tokens - 1);
    }
    retryAfterMs(key, cfg) {
        if (cfg.launchesPerMinute <= 0)
            return this.recheckMs;
        const tokens = this.availableTokens(key, cfg);
        if (tokens >= 1)
            return 0;
        return Math.ceil(((1 - tokens) * 60_000) / cfg.launchesPerMinute);
    }
    updatePeak(key) {
        const stats = this.stats.get(key) ?? { peak: 0, countErrors: 0 };
        const current = (this.observed.get(key) ?? 0) + (this.pending.get(key) ?? 0);
        stats.peak = Math.max(stats.peak, current);
        this.stats.set(key, stats);
        let total = 0;
        for (const knownKey of this.known) {
            total += (this.observed.get(knownKey) ?? 0) + (this.pending.get(knownKey) ?? 0);
        }
        this.peakCurrentTotal = Math.max(this.peakCurrentTotal, total);
    }
    queuedTotal() {
        let total = 0;
        for (const queue of this.waiters.values())
            total += queue.length;
        return total;
    }
    removeWaiter(waiter) {
        const queue = this.waiters.get(waiter.key);
        if (!queue)
            return;
        const index = queue.indexOf(waiter);
        if (index >= 0)
            queue.splice(index, 1);
        if (queue.length === 0)
            this.waiters.delete(waiter.key);
        if (waiter.timer) {
            clearTimeout(waiter.timer);
            waiter.timer = null;
        }
    }
    startPump() {
        if (this.pumpTimer)
            return;
        this.pumpTimer = setInterval(() => this.pumpAll(), this.recheckMs);
        // A waiter must not keep the process alive on its own.
        this.pumpTimer.unref?.();
    }
    stopPumpIfIdle() {
        if (this.pumpTimer && this.queuedTotal() === 0) {
            clearInterval(this.pumpTimer);
            this.pumpTimer = null;
        }
    }
    /** Admit as many queued waiters as the current config allows, FIFO per key. */
    pumpAll() {
        const cfgResult = this.config();
        const cfg = cfgResult.config ?? DEFAULT_PROVIDER_LIMIT_CONFIG;
        if (cfgResult.reason || !enforced(cfg)) {
            // Feature turned off (or the config became unreadable): release waiters
            // as not_enforced, exactly like a disabled acquire.
            for (const queue of [...this.waiters.values()]) {
                for (const waiter of [...queue]) {
                    if (waiter.settled)
                        continue;
                    this.removeWaiter(waiter);
                    waiter.settled = true;
                    waiter.resolve(this.immediate(waiter.provider, waiter.model, waiter.enqueuedAt, cfgResult.reason ?? "disabled"));
                }
            }
            this.stopPumpIfIdle();
            return;
        }
        for (const [key, queue] of [...this.waiters]) {
            while (queue.length > 0) {
                const waiter = queue[0];
                if (waiter.settled) {
                    queue.shift();
                    continue;
                }
                if (!this.canAdmitNow(key, waiter.provider, waiter.model, cfg))
                    break;
                queue.shift();
                waiter.settled = true;
                if (waiter.timer) {
                    clearTimeout(waiter.timer);
                    waiter.timer = null;
                }
                waiter.resolve(this.reserve(key, waiter.provider, waiter.model, waiter.enqueuedAt));
            }
            if (queue.length === 0)
                this.waiters.delete(key);
        }
        this.stopPumpIfIdle();
    }
}
//# sourceMappingURL=provider-rate-limit.js.map