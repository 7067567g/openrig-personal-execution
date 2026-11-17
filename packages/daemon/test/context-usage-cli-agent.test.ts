import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Database } from "better-sqlite3";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDb } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { ContextUsageStore, FRESHNESS_THRESHOLD_MS } from "../src/domain/context-usage-store.js";
import { ALL_MIGRATIONS } from "../src/db/all-migrations.js";
import { RigRepository } from "../src/domain/rig-repository.js";
import { SessionRegistry } from "../src/domain/session-registry.js";

// Read-surface contract for the OpenCode/DSH runner `usage.json` sidecar
// (packet 4). Fixtures are literal JSON — the producer module is covered by
// its own tests, so this file pins the consumer mapping independently.

describe("ContextUsageStore.readCliAgentAndNormalize", () => {
  let db: Database.Database;
  let store: ContextUsageStore;
  let home: string;

  beforeEach(() => {
    db = createDb();
    migrate(db, ALL_MIGRATIONS);
    home = mkdtempSync(join(tmpdir(), "openrig-cli-usage-"));
    store = new ContextUsageStore(db, { stateDir: home });
  });

  afterEach(() => {
    db.close();
    rmSync(home, { recursive: true, force: true });
  });

  const SESSION = "exec-tdo-oc@test-rig";

  function usagePath(runtime: "opencode" | "dsh"): string {
    return join(home, "state", runtime, SESSION, "usage.json");
  }

  function writeUsage(runtime: "opencode" | "dsh", sidecar: unknown): void {
    const target = usagePath(runtime);
    mkdirSync(join(home, "state", runtime, SESSION), { recursive: true });
    writeFileSync(target, typeof sidecar === "string" ? sidecar : JSON.stringify(sidecar));
  }

  const opencodeSidecar = {
    schemaVersion: 1,
    runtime: "opencode",
    sessionName: SESSION,
    sessionId: "ses_abc",
    sampledAt: new Date().toISOString(),
    steps: 3,
    totals: { input: 100, output: 40, reasoning: 10, cacheRead: 25, cacheWrite: 5, total: null, costUsd: 0.125 },
    lastStep: {
      at: new Date().toISOString(),
      input: 50,
      output: 20,
      reasoning: 5,
      cacheRead: 10,
      cacheWrite: 2,
      total: null,
      costUsd: 0.05,
    },
  };

  const dshSidecar = {
    schemaVersion: 1,
    runtime: "dsh",
    sessionName: SESSION,
    sessionId: "session-abc",
    sampledAt: new Date().toISOString(),
    steps: 2,
    totals: { input: 60, output: 20, reasoning: null, cacheRead: 4, cacheWrite: 1, total: null, costUsd: null },
    lastStep: { at: new Date().toISOString(), input: 30, output: 10, reasoning: null, cacheRead: 2, cacheWrite: 0, total: null, costUsd: null },
  };

  it("normalizes an opencode sidecar: prompt/output totals, source, cost and step detail", () => {
    writeUsage("opencode", opencodeSidecar);

    const usage = store.readCliAgentAndNormalize({ runtime: "opencode", sessionName: SESSION });

    expect(usage.availability).toBe("known");
    expect(usage.reason).toBeNull();
    expect(usage.source).toBe("opencode_runner_json");
    // prompt = input + cacheRead, output = output + reasoning
    expect(usage.totalInputTokens).toBe(125);
    expect(usage.totalOutputTokens).toBe(50);
    expect(usage.clientCostEstimateUsd).toBe(0.125);
    expect(usage.sessionId).toBe("ses_abc");
    expect(usage.sessionName).toBe(SESSION);
    expect(usage.sampledAt).toBe(opencodeSidecar.sampledAt);
    expect(usage.fresh).toBe(true);
    // The runners carry no context-window measurement; unknown is null, not zero.
    expect(usage.usedPercentage).toBeNull();
    expect(usage.contextWindowSize).toBeNull();

    const breakdown = JSON.parse(usage.currentUsage ?? "null") as Record<string, unknown>;
    expect(breakdown["steps"]).toBe(3);
    expect(breakdown["lastStep"]).toMatchObject({ input: 50, costUsd: 0.05 });
    expect(breakdown["totals"]).toMatchObject({ costUsd: 0.125 });
  });

  it("normalizes a dsh sidecar with null cost and unreported reasoning", () => {
    writeUsage("dsh", dshSidecar);

    const usage = store.readCliAgentAndNormalize({ runtime: "dsh", sessionName: SESSION });

    expect(usage.availability).toBe("known");
    expect(usage.source).toBe("dsh_runner_json");
    expect(usage.totalInputTokens).toBe(64);
    expect(usage.totalOutputTokens).toBe(20);
    expect(usage.clientCostEstimateUsd).toBeNull();
    expect(usage.sessionId).toBe("session-abc");
  });

  it("maps a stale sampledAt to known but not fresh", () => {
    const stale = new Date(Date.now() - FRESHNESS_THRESHOLD_MS - 60_000).toISOString();
    writeUsage("opencode", { ...opencodeSidecar, sampledAt: stale });

    const usage = store.readCliAgentAndNormalize({ runtime: "opencode", sessionName: SESSION });

    expect(usage.availability).toBe("known");
    expect(usage.sampledAt).toBe(stale);
    expect(usage.fresh).toBe(false);
  });

  it("returns unknown/missing_sidecar when no usage.json exists", () => {
    const usage = store.readCliAgentAndNormalize({ runtime: "opencode", sessionName: SESSION });
    expect(usage.availability).toBe("unknown");
    expect(usage.reason).toBe("missing_sidecar");
    expect(usage.source).toBeNull();
  });

  it("returns unknown/parse_error for broken JSON or a missing required field", () => {
    writeUsage("opencode", "{not json");
    expect(store.readCliAgentAndNormalize({ runtime: "opencode", sessionName: SESSION })).toMatchObject({
      availability: "unknown",
      reason: "parse_error",
    });

    const { totals: _totals, ...withoutTotals } = opencodeSidecar;
    writeUsage("opencode", withoutTotals);
    expect(store.readCliAgentAndNormalize({ runtime: "opencode", sessionName: SESSION })).toMatchObject({
      availability: "unknown",
      reason: "parse_error",
    });
  });

  it("rejects a sidecar whose runtime does not match the requested runtime", () => {
    writeUsage("opencode", { ...dshSidecar, runtime: "dsh" });

    const usage = store.readCliAgentAndNormalize({ runtime: "opencode", sessionName: SESSION });

    expect(usage.availability).toBe("unknown");
    expect(usage.reason).toBe("parse_error");
  });

  it("keeps a totalTokens-only sidecar known without inventing component zeros", () => {
    writeUsage("dsh", {
      ...dshSidecar,
      steps: 1,
      totals: {
        input: null, output: null, reasoning: null,
        cacheRead: null, cacheWrite: null, total: 77, costUsd: null,
      },
      lastStep: {
        at: new Date().toISOString(),
        input: null, output: null, reasoning: null,
        cacheRead: null, cacheWrite: null, total: 77, costUsd: null,
      },
    });

    const usage = store.readCliAgentAndNormalize({ runtime: "dsh", sessionName: SESSION });
    expect(usage.availability).toBe("known");
    expect(usage.totalInputTokens).toBeNull();
    expect(usage.totalOutputTokens).toBeNull();
    const detail = JSON.parse(usage.currentUsage ?? "null") as Record<string, any>;
    expect(detail["totals"]["total"]).toBe(77);
    expect(detail["totals"]["input"]).toBeNull();
    expect(detail["coverage"]["input"]).toBe("not_reported");
  });

  it("does not turn missing counters into a known zero when some counters are present", () => {
    writeUsage("opencode", {
      ...opencodeSidecar,
      steps: 1,
      totals: {
        input: 9, output: null, reasoning: null,
        cacheRead: null, cacheWrite: null, total: null, costUsd: null,
      },
      lastStep: {
        at: new Date().toISOString(),
        input: 9, output: null, reasoning: null,
        cacheRead: null, cacheWrite: null, total: null, costUsd: null,
      },
    });

    const usage = store.readCliAgentAndNormalize({ runtime: "opencode", sessionName: SESSION });
    expect(usage.availability).toBe("known");
    expect(usage.totalInputTokens).toBe(9);
    expect(usage.totalOutputTokens).toBeNull();
    const detail = JSON.parse(usage.currentUsage ?? "null") as Record<string, any>;
    expect(detail["totals"]["output"]).toBeNull();
    expect(detail["totals"]["cacheRead"]).toBeNull();
    expect(detail["coverage"]["output"]).toBe("not_reported");
    expect(detail["coverage"]["cacheRead"]).toBe("not_reported");
  });

  it("rejects a predecessor's sidecar when the live DB tenure has a different generation", () => {
    const rigRepo = new RigRepository(db);
    const rig = rigRepo.createRig("usage-rig");
    const node = rigRepo.addNode(rig.id, "dev.impl", { runtime: "opencode" });
    new SessionRegistry(db).registerSession(node.id, SESSION, "initial", "gen-live");

    writeUsage("opencode", { ...opencodeSidecar, occupantGeneration: "gen-predecessor" });
    expect(store.readCliAgentAndNormalize({ runtime: "opencode", sessionName: SESSION })).toMatchObject({
      availability: "unknown",
      reason: "stale_generation",
    });

    writeUsage("opencode", { ...opencodeSidecar, occupantGeneration: "gen-live" });
    const current = store.readCliAgentAndNormalize({ runtime: "opencode", sessionName: SESSION });
    expect(current.availability).toBe("known");
    const detail = JSON.parse(current.currentUsage ?? "null") as Record<string, unknown>;
    expect(detail["occupantGeneration"]).toBe("gen-live");
  });

  it("rejects a legacy generation-less sidecar when the live tenure is known", () => {
    const rigRepo = new RigRepository(db);
    const rig = rigRepo.createRig("usage-rig");
    const node = rigRepo.addNode(rig.id, "dev.impl", { runtime: "opencode" });
    new SessionRegistry(db).registerSession(node.id, SESSION, "initial", "gen-live");
    writeUsage("opencode", opencodeSidecar);

    expect(store.readCliAgentAndNormalize({ runtime: "opencode", sessionName: SESSION })).toMatchObject({
      availability: "unknown",
      reason: "stale_generation",
    });
  });

  it("accepts an explicit matching generation fence and rejects a missing sidecar generation", () => {
    writeUsage("opencode", { ...opencodeSidecar, occupantGeneration: "gen-match" });
    expect(store.readCliAgentAndNormalize({
      runtime: "opencode", sessionName: SESSION, occupantGeneration: "gen-match",
    }).availability).toBe("known");
    expect(store.readCliAgentAndNormalize({
      runtime: "opencode", sessionName: SESSION, occupantGeneration: "gen-other",
    })).toMatchObject({ availability: "unknown", reason: "stale_generation" });

    writeUsage("opencode", opencodeSidecar);
    expect(store.readCliAgentAndNormalize({
      runtime: "opencode", sessionName: SESSION, occupantGeneration: "gen-match",
    })).toMatchObject({ availability: "unknown", reason: "stale_generation" });
  });
});
