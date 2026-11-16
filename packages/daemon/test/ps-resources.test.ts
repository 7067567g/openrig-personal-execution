import { describe, expect, it } from "vitest";
import { projectSeatResources, type SeatResourceEntry, type SeatResourcesSources } from "../src/domain/ps-resources.js";
import type { NodeInventoryEntry } from "../src/domain/types.js";
import { LaunchAdmissionQueue } from "../src/domain/launch-admission.js";
import { ProviderRateLimiter } from "../src/domain/provider-rate-limit.js";
import type { CliAgentBudgetSidecar } from "../src/adapters/cli-agent/cli-agent-runner-protocol.js";
import type { TaskBudgetConfig } from "../src/adapters/cli-agent/task-budget.js";

function seat(overrides: Partial<NodeInventoryEntry> = {}): NodeInventoryEntry {
  return {
    nodeId: "n1", rigId: "r1", rigName: "fixture", logicalId: "fixture.builder",
    canonicalSessionName: "fixture-builder", runtime: "claude-code", model: "claude-sonnet",
    sessionStatus: "running",
    ...overrides,
  } as unknown as NodeInventoryEntry;
}

function byResource(rows: ReturnType<typeof projectSeatResources>, resource: string): SeatResourceEntry {
  const entry = rows[0]!.resources.find((candidate) => candidate.resource === resource);
  if (!entry) throw new Error(`missing resource ${resource}`);
  return entry;
}

const ENABLED_BUDGET: TaskBudgetConfig = {
  enabled: true,
  maxWallTimeMs: 1_800_000,
  maxSteps: 200,
  maxToolCalls: 100,
  maxTokens: 0,
  maxRetries: 0,
};

const DSH_SIDECAR: CliAgentBudgetSidecar = {
  enforced: true,
  retries_used: 0,
  coverage: { steps: "not_reported", tool_calls: "not_reported", tokens: "not_reported" },
  observed: { steps: 0, tool_calls: 0, tokens: 0, wall_time_ms: 12_345 },
};

describe("projectSeatResources — provider and launch gates", () => {
  it("reports the live cap, current and peak of the provider/model semaphore", async () => {
    const limiter = new ProviderRateLimiter({
      readConfig: () => ({ enabled: true, maxActiveSeats: 2, launchesPerMinute: 0, burst: 0, queueTimeoutSeconds: 0 }),
      countLive: () => 0,
    });
    await limiter.acquire({ provider: "claude", model: "claude-sonnet" });
    await limiter.acquire({ provider: "claude", model: "claude-sonnet" });

    const rows = projectSeatResources({
      entries: [seat()],
      sources: { providerLimit: limiter },
      platform: "linux",
    });
    const provider = byResource(rows, "provider_seats");
    expect(provider).toMatchObject({
      scope: "provider_model",
      limit: 2,
      current: 1,
      peak: 2,
      peakScope: "since_daemon_start",
      enforcedBy: "config",
      backend: "provider_semaphore",
    });
    expect(provider.reason).toBeUndefined();
  });

  it("says disabled with a reason instead of inventing a cap", () => {
    const limiter = new ProviderRateLimiter({
      readConfig: () => ({ enabled: false, maxActiveSeats: 0, launchesPerMinute: 0, burst: 0, queueTimeoutSeconds: 0 }),
      countLive: () => 0,
    });
    const rows = projectSeatResources({ entries: [seat()], sources: { providerLimit: limiter }, platform: "linux" });
    const provider = byResource(rows, "provider_seats");
    expect(provider.limit).toBeNull();
    expect(provider.peak).toBeNull();
    expect(provider.enforcedBy).toBe("not_enforced");
    expect(provider.reason).toBe("disabled");
    // The live count is still a real observation, not a fabricated zero.
    expect(provider.current).toBe(1);
  });

  it("does not claim a live-seat cap when only the launch rate is configured", () => {
    const limiter = new ProviderRateLimiter({
      readConfig: () => ({ enabled: true, maxActiveSeats: 0, launchesPerMinute: 6, burst: 2, queueTimeoutSeconds: 0 }),
      countLive: () => 0,
    });
    const rows = projectSeatResources({ entries: [seat()], sources: { providerLimit: limiter }, platform: "linux" });
    const provider = byResource(rows, "provider_seats");
    expect(provider.enforcedBy).toBe("not_enforced");
    expect(provider.reason).toBe("no_limit");
    expect(provider.peak).toBeNull();
  });

  it("reports the per-rig launch slot and its peak", async () => {
    const admission = new LaunchAdmissionQueue(() => ({
      enabled: true, maxConcurrent: 4, maxPerRig: 2, reservedInteractive: 1, queueTimeoutSeconds: 0,
    }));
    await admission.acquire({ rigId: "r1", lane: "background" });
    const rows = projectSeatResources({ entries: [seat()], sources: { launchAdmission: admission }, platform: "linux" });
    expect(byResource(rows, "launch_slot")).toMatchObject({
      scope: "rig",
      limit: 2,
      current: 1,
      peak: 1,
      enforcedBy: "config",
      backend: "launch_admission",
    });
  });

  it("keeps every snapshot source optional and honest when it is absent", () => {
    const rows = projectSeatResources({ entries: [seat()], platform: "linux" });
    expect(byResource(rows, "provider_seats").reason).toBe("snapshot_unavailable");
    expect(byResource(rows, "launch_slot").reason).toBe("snapshot_unavailable");
    expect(rows[0]!.resources.every((entry) => entry.enforcedBy === "not_enforced")).toBe(true);
  });
});

describe("projectSeatResources — per-turn budgets", () => {
  it("reports disabled for every budget dimension when the switch is off", () => {
    const rows = projectSeatResources({ entries: [seat()], sources: { budgetLimits: () => undefined }, platform: "linux" });
    for (const resource of ["wall_time", "steps", "tool_calls", "tokens"] as const) {
      expect(byResource(rows, resource)).toMatchObject({
        enforcedBy: "not_enforced", reason: "disabled", limit: null, current: null, peak: null,
        backend: "runner_sidecar",
      });
    }
  });

  it("enforces wall time but reports the DSH stream's step/tool/token coverage as not_reported", () => {
    const sources = {
      budgetLimits: () => ENABLED_BUDGET,
      readBudgetSidecar: () => DSH_SIDECAR,
    };
    const rows = projectSeatResources({ entries: [seat({ runtime: "dsh", model: null })], sources, platform: "linux" });

    expect(byResource(rows, "wall_time")).toMatchObject({
      limit: 1_800_000, current: 12_345, peak: 12_345, peakScope: "last_turn",
      enforcedBy: "config", backend: "runner_sidecar", coverage: "reported",
    });
    // Configured caps exist, but the runtime never carried the evidence.
    for (const resource of ["steps", "tool_calls"] as const) {
      expect(byResource(rows, resource)).toMatchObject({
        limit: resource === "steps" ? 200 : 100,
        current: 0,
        enforcedBy: "not_enforced",
        reason: "not_reported_by_runtime",
        coverage: "not_reported",
      });
    }
    expect(byResource(rows, "tokens")).toMatchObject({ limit: null, reason: "no_limit" });
  });

  it("does not call an enabled budget enforced when the seat has no runner sidecar", () => {
    const rows = projectSeatResources({
      entries: [seat()],
      sources: { budgetLimits: () => ENABLED_BUDGET, readBudgetSidecar: () => null },
      platform: "linux",
    });
    // No sidecar means no measurement, so wall time cannot claim coverage either.
    expect(byResource(rows, "wall_time")).toMatchObject({
      limit: 1_800_000, current: null, enforcedBy: "not_enforced", reason: "no_runner_sidecar",
      coverage: "not_reported",
    });
  });

  it("surfaces a recorded budget breach on its dimension", () => {
    const sidecar: CliAgentBudgetSidecar = {
      ...DSH_SIDECAR,
      exhausted: { dimension: "wall_time", limit: 1_800_000, observed: 1_800_001, at: "2026-10-24T00:00:00Z" },
      observed: { ...DSH_SIDECAR.observed, wall_time_ms: 1_800_001 },
    };
    const rows = projectSeatResources({
      entries: [seat({ runtime: "dsh", model: null })],
      sources: { budgetLimits: () => ENABLED_BUDGET, readBudgetSidecar: () => sidecar },
      platform: "linux",
    });
    expect(byResource(rows, "wall_time").exhausted).toBe(true);
  });
});

describe("projectSeatResources — platform resources", () => {
  it("marks CPU and memory not_enforced with an implementation reason on Linux", () => {
    const rows = projectSeatResources({ entries: [seat()], platform: "linux" });
    for (const resource of ["cpu", "memory"] as const) {
      expect(byResource(rows, resource)).toMatchObject({
        scope: "platform", limit: null, current: null, peak: null,
        enforcedBy: "not_enforced", backend: "none", reason: "cgroup_budget_not_implemented",
      });
    }
  });

  it("marks them platform_unsupported where no cgroup backend exists", () => {
    const rows = projectSeatResources({ entries: [seat()], platform: "darwin" });
    expect(byResource(rows, "cpu").reason).toBe("platform_unsupported");
    expect(byResource(rows, "memory").reason).toBe("platform_unsupported");
  });
});

describe("projectSeatResources — seat shape", () => {
  it("keeps one row per registered seat, including stopped seats and their real identity", () => {
    const rows = projectSeatResources({
      entries: [
        seat(),
        seat({
          nodeId: "n2", logicalId: "fixture.stopped", canonicalSessionName: "fixture-stopped",
          sessionStatus: "stopped", model: null, runtime: "dsh",
        }),
      ],
      sources: {} as SeatResourcesSources,
      platform: "linux",
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rigName: "fixture", seat: "fixture.builder", running: true });
    expect(rows[1]).toMatchObject({ seat: "fixture.stopped", running: false, model: null });
    expect(rows[1]!.resources).toHaveLength(8);
  });

  it("counts the same live-seat statuses the provider gate occupies, not just 'running'", () => {
    const rows = projectSeatResources({
      entries: [
        seat({ nodeId: "n1", sessionStatus: "idle", storedSessionStatus: "idle" }),
        seat({ nodeId: "n2", sessionStatus: "unknown", storedSessionStatus: "unknown" }),
        // Identity-downranked in the view, still a live registry row; the gate
        // counts it, so `current` must too.
        seat({ nodeId: "n3", sessionStatus: "detached", storedSessionStatus: "running" }),
        seat({ nodeId: "n4", sessionStatus: "stopped", storedSessionStatus: "exited" }),
      ],
      platform: "linux",
    });
    expect(rows[0]!.running).toBe(false);
    expect(byResource([rows[0]!], "provider_seats").current).toBe(3);
    expect(byResource([rows[1]!], "provider_seats").current).toBe(3);
    expect(byResource([rows[2]!], "provider_seats").current).toBe(3);
    expect(byResource([rows[3]!], "provider_seats").current).toBe(3);
  });

  it("counts provider live seats per exact provider/model key", async () => {
    const limiter = new ProviderRateLimiter({
      readConfig: () => ({ enabled: true, maxActiveSeats: 4, launchesPerMinute: 0, burst: 0, queueTimeoutSeconds: 0 }),
      countLive: () => 0,
    });
    const rows = projectSeatResources({
      entries: [
        seat({ nodeId: "n1", model: "claude-sonnet" }),
        seat({ nodeId: "n2", model: "claude-opus" }),
        seat({ nodeId: "n3", model: null }),
      ],
      sources: { providerLimit: limiter },
      platform: "linux",
    });
    expect(byResource([rows[0]!], "provider_seats").current).toBe(1);
    expect(byResource([rows[1]!], "provider_seats").current).toBe(1);
    expect(byResource([rows[2]!], "provider_seats").current).toBe(1);
  });
});
