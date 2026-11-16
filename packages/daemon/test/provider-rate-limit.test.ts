import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROVIDER_LIMIT_CONFIG,
  ProviderRateLimiter,
  providerForRuntime,
  runtimesForProvider,
  type ProviderLimitConfig,
  type ProviderLimitResult,
} from "../src/domain/provider-rate-limit.js";

function config(patch: Partial<ProviderLimitConfig> = {}): ProviderLimitConfig {
  return { ...DEFAULT_PROVIDER_LIMIT_CONFIG, enabled: true, ...patch };
}

async function waitFor(predicate: () => boolean, timeoutMs = 1500): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe("provider/runtime mapping", () => {
  it("maps known runtimes to provider families and keeps unknown runtimes as themselves", () => {
    expect(providerForRuntime("claude-code")).toBe("claude");
    expect(providerForRuntime("codex")).toBe("codex");
    expect(providerForRuntime("dsh")).toBe("deepseek");
    expect(providerForRuntime("pi")).toBe("pi");
    expect(providerForRuntime("custom-runtime")).toBe("custom-runtime");
    expect(providerForRuntime(null)).toBe("unknown");
    expect(runtimesForProvider("claude")).toEqual(["claude-code"]);
    expect(runtimesForProvider("custom-runtime")).toEqual(["custom-runtime"]);
  });
});

describe("ProviderRateLimiter", () => {
  it("is disabled by default: admits immediately, counts nothing, never queries live seats", async () => {
    let countCalls = 0;
    const limiter = new ProviderRateLimiter({ countLive: () => { countCalls += 1; return 9; } });
    const first = await limiter.acquire({ provider: "claude", model: "opus" });
    const second = await limiter.acquire({ provider: "codex", model: null });
    expect(first).toMatchObject({ ok: true, enforcedBy: "not_enforced", reason: "disabled" });
    expect((first as { waitedMs: number }).waitedMs).toBeGreaterThanOrEqual(0);
    expect(second).toMatchObject({ ok: true, enforcedBy: "not_enforced", reason: "disabled" });
    expect(countCalls).toBe(0);
    expect(limiter.snapshot()).toMatchObject({
      enabled: false,
      enforcedBy: "not_enforced",
      reason: "disabled",
      current: { total: 0 },
      queued: { total: 0 },
    });
  });

  it("enabled with no numeric limit admits immediately and reports no_limit", async () => {
    const limiter = new ProviderRateLimiter({
      readConfig: () => config({ maxActiveSeats: 0, launchesPerMinute: 0 }),
      countLive: () => 99,
    });
    const lease = await limiter.acquire({ provider: "claude", model: "opus" });
    expect(lease).toMatchObject({ ok: true, enforcedBy: "not_enforced", reason: "no_limit" });
    limiter.release((lease as { leaseId: string }).leaseId);
    expect(limiter.snapshot().current.total).toBe(0);
  });

  it("queues when the live-seat cap is reached and admits after the count drops", async () => {
    let live = 1;
    const limiter = new ProviderRateLimiter({
      readConfig: () => config({ maxActiveSeats: 1, queueTimeoutSeconds: 5 }),
      countLive: () => live,
      recheckMs: 5,
    });
    let result: ProviderLimitResult | undefined;
    void limiter.acquire({ provider: "claude", model: "opus" }).then((value) => { result = value; });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(result).toBeUndefined();
    expect(limiter.snapshot().queued.total).toBe(1);

    live = 0;
    await waitFor(() => result !== undefined);
    expect(result).toMatchObject({ ok: true, enforcedBy: "config" });
    expect(limiter.snapshot()).toMatchObject({
      current: { total: 1 },
      limits: { maxActiveSeats: 1 },
    });
    limiter.release((result as { leaseId: string }).leaseId);
    expect(limiter.snapshot().current.total).toBe(0);
  });

  it("bounds launch bursts with a token bucket and reports the wait", async () => {
    let now = 1_000;
    const limiter = new ProviderRateLimiter({
      readConfig: () => config({ launchesPerMinute: 60, burst: 1, queueTimeoutSeconds: 5 }),
      countLive: () => 0,
      now: () => now,
      recheckMs: 5,
    });
    const first = await limiter.acquire({ provider: "codex", model: "gpt" });
    expect(first).toMatchObject({ ok: true, enforcedBy: "config" });
    limiter.release((first as { leaseId: string }).leaseId);

    let second: ProviderLimitResult | undefined;
    void limiter.acquire({ provider: "codex", model: "gpt" }).then((value) => { second = value; });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(second).toBeUndefined();

    now += 1_000; // one token at 60/min
    await waitFor(() => second !== undefined);
    expect(second).toMatchObject({ ok: true, enforcedBy: "config" });
    expect((second as { waitedMs: number }).waitedMs).toBeGreaterThanOrEqual(1_000);
    limiter.release((second as { leaseId: string }).leaseId);
  });

  it("returns provider_rate_limited on timeout without starting anything", async () => {
    const limiter = new ProviderRateLimiter({
      readConfig: () => config({ maxActiveSeats: 1, queueTimeoutSeconds: 0.05 }),
      countLive: () => 1,
      recheckMs: 5,
    });
    const result = await limiter.acquire({ provider: "claude", model: "opus" });
    expect(result).toMatchObject({ ok: false, code: "provider_rate_limited", provider: "claude", model: "opus" });
    expect((result as { waitedMs: number }).waitedMs).toBeGreaterThanOrEqual(40);
    expect((result as { retryAfterMs: number }).retryAfterMs).toBeGreaterThanOrEqual(0);
    expect(limiter.snapshot().current.total).toBe(1);
    expect(limiter.snapshot().queued.total).toBe(0);
  });

  it("isolates keys by provider/model", async () => {
    const live: Record<string, number> = { "claude\u0000opus": 1, "codex\u0000gpt": 0 };
    const limiter = new ProviderRateLimiter({
      readConfig: () => config({ maxActiveSeats: 1, queueTimeoutSeconds: 0.2 }),
      countLive: ({ provider, model }) => live[`${provider}\u0000${model}`] ?? 0,
      recheckMs: 5,
    });
    let blocked = false;
    void limiter.acquire({ provider: "claude", model: "opus" }).then((result) => {
      blocked = !result.ok;
    });
    const codex = await limiter.acquire({ provider: "codex", model: "gpt" });
    expect(codex).toMatchObject({ ok: true, enforcedBy: "config" });
    await waitFor(() => blocked);
    expect(limiter.snapshot().byKey).toMatchObject({
      "claude/opus": { live: 1, queued: 0 },
      "codex/gpt": { live: 0, pending: 1, current: 1 },
    });
  });

  it("fails open when the live-seat reader throws, and reports the failure", async () => {
    const limiter = new ProviderRateLimiter({
      readConfig: () => config({ maxActiveSeats: 1, queueTimeoutSeconds: 0.2 }),
      countLive: () => { throw new Error("db unavailable"); },
      recheckMs: 5,
    });
    const lease = await limiter.acquire({ provider: "claude", model: "opus" });
    expect(lease).toMatchObject({ ok: true, enforcedBy: "config" });
    limiter.release((lease as { leaseId: string }).leaseId);
    expect(limiter.snapshot().byKey["claude/opus"]?.countErrors).toBeGreaterThan(0);
  });

  it("releases queued starts as not_enforced if the feature is turned off while they wait", async () => {
    let enabled = true;
    const limiter = new ProviderRateLimiter({
      readConfig: () => config({ enabled, maxActiveSeats: 1, queueTimeoutSeconds: 5 }),
      countLive: () => 1,
      recheckMs: 5,
    });
    let result: ProviderLimitResult | undefined;
    void limiter.acquire({ provider: "claude", model: "opus" }).then((value) => { result = value; });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(result).toBeUndefined();
    enabled = false;
    await waitFor(() => result !== undefined);
    expect(result).toMatchObject({ ok: true, enforcedBy: "not_enforced", reason: "disabled" });
  });
});
