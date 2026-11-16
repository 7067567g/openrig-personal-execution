import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { RigRepository } from "../src/domain/rig-repository.js";
import { SessionRegistry } from "../src/domain/session-registry.js";
import { EventBus } from "../src/domain/event-bus.js";
import { NodeLauncher } from "../src/domain/node-launcher.js";
import type { TmuxAdapter, TmuxResult } from "../src/adapters/tmux.js";
import {
  DEFAULT_PROVIDER_LIMIT_CONFIG,
  ProviderRateLimiter,
  type ProviderLimitConfig,
} from "../src/domain/provider-rate-limit.js";
import { createFullTestDb } from "./helpers/test-app.js";

function mockTmuxAdapter(onCreate?: () => void): TmuxAdapter {
  return {
    createSession: async (): Promise<TmuxResult> => { onCreate?.(); return { ok: true as const }; },
    killSession: async () => ({ ok: true as const }),
    listSessions: async () => [],
    listWindows: async () => [],
    listPanes: async () => [],
    hasSession: async () => false,
    sendText: async () => ({ ok: true as const }),
    sendKeys: async () => ({ ok: true as const }),
  } as unknown as TmuxAdapter;
}

function limitConfig(patch: Partial<ProviderLimitConfig> = {}): ProviderLimitConfig {
  return { ...DEFAULT_PROVIDER_LIMIT_CONFIG, enabled: true, ...patch };
}

describe("NodeLauncher provider/model start limit", () => {
  let db: Database.Database;
  let rigRepo: RigRepository;
  let sessionRegistry: SessionRegistry;
  let eventBus: EventBus;

  beforeEach(() => {
    db = createFullTestDb();
    rigRepo = new RigRepository(db);
    sessionRegistry = new SessionRegistry(db);
    eventBus = new EventBus(db);
  });

  afterEach(() => { db.close(); });

  function seed() {
    const rig = rigRepo.createRig("r01");
    rigRepo.addNode(rig.id, "dev1-impl", { role: "worker", runtime: "claude-code", model: "opus" });
    return rig;
  }

  it("starts nothing and returns provider_rate_limited when the live-seat cap is full", async () => {
    const rig = seed();
    let creates = 0;
    const limiter = new ProviderRateLimiter({
      readConfig: () => limitConfig({ maxActiveSeats: 1, queueTimeoutSeconds: 0.05 }),
      countLive: () => 1,
      recheckMs: 5,
    });
    const nodeLauncher = new NodeLauncher({
      db, rigRepo, sessionRegistry, eventBus,
      tmuxAdapter: mockTmuxAdapter(() => { creates += 1; }),
      providerRateLimit: limiter,
    });

    const result = await nodeLauncher.launchNode(rig.id, "dev1-impl");
    expect(result).toMatchObject({ ok: false, code: "provider_rate_limited" });
    expect(creates).toBe(0);
    expect(limiter.snapshot().current.total).toBe(1);
  });

  it("passes provider/model and releases the slot after a successful launch", async () => {
    const rig = seed();
    const seen: Array<{ provider: string; model: string }> = [];
    const limiter = new ProviderRateLimiter({
      readConfig: () => limitConfig({ maxActiveSeats: 2 }),
      countLive: (input) => { seen.push(input); return 0; },
    });
    const nodeLauncher = new NodeLauncher({
      db, rigRepo, sessionRegistry, eventBus,
      tmuxAdapter: mockTmuxAdapter(),
      providerRateLimit: limiter,
    });

    expect((await nodeLauncher.launchNode(rig.id, "dev1-impl")).ok).toBe(true);
    expect(seen[0]).toEqual({ provider: "claude", model: "opus" });
    expect(limiter.snapshot().current.total).toBe(0);
  });

  it("releases the slot when a later launch step fails", async () => {
    const rig = seed();
    const limiter = new ProviderRateLimiter({
      readConfig: () => limitConfig({ maxActiveSeats: 1 }),
      countLive: () => 0,
    });
    const nodeLauncher = new NodeLauncher({
      db, rigRepo, sessionRegistry, eventBus,
      tmuxAdapter: { ...mockTmuxAdapter(), createSession: async () => ({ ok: false, code: "tmux_error", message: "boom" }) } as unknown as TmuxAdapter,
      providerRateLimit: limiter,
    });

    const result = await nodeLauncher.launchNode(rig.id, "dev1-impl");
    expect(result.ok).toBe(false);
    expect(limiter.snapshot().current.total).toBe(0);
    expect(limiter.snapshot().queued.total).toBe(0);
  });

  it("without an injected limiter, launch behaviour is unchanged and no live count is read", async () => {
    const rig = seed();
    let creates = 0;
    const nodeLauncher = new NodeLauncher({
      db, rigRepo, sessionRegistry, eventBus,
      tmuxAdapter: mockTmuxAdapter(() => { creates += 1; }),
    });
    expect((await nodeLauncher.launchNode(rig.id, "dev1-impl")).ok).toBe(true);
    expect(creates).toBe(1);
  });
});
