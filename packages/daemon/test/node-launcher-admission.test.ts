import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { RigRepository } from "../src/domain/rig-repository.js";
import { SessionRegistry } from "../src/domain/session-registry.js";
import { EventBus } from "../src/domain/event-bus.js";
import { NodeLauncher } from "../src/domain/node-launcher.js";
import type { TmuxAdapter, TmuxResult } from "../src/adapters/tmux.js";
import type { LaunchAdmission, LaunchAdmissionResult } from "../src/domain/launch-admission.js";
import { LaunchAdmissionQueue } from "../src/domain/launch-admission.js";
import { createFullTestDb } from "./helpers/test-app.js";

function mockTmuxAdapter(overrides?: {
  createSession?: (name: string, cwd?: string, env?: Record<string, string>) => Promise<TmuxResult>;
}): TmuxAdapter {
  return {
    createSession: overrides?.createSession ?? (async () => ({ ok: true as const })),
    killSession: async () => ({ ok: true as const }),
    listSessions: async () => [],
    listWindows: async () => [],
    listPanes: async () => [],
    hasSession: async () => false,
    sendText: async () => ({ ok: true as const }),
    sendKeys: async () => ({ ok: true as const }),
  } as unknown as TmuxAdapter;
}

describe("NodeLauncher launch admission", () => {
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

  afterEach(() => {
    db.close();
  });

  function seedTwoNodes() {
    const rig = rigRepo.createRig("r01");
    rigRepo.addNode(rig.id, "dev1-impl", { role: "worker", runtime: "claude-code" });
    rigRepo.addNode(rig.id, "dev2-impl", { role: "worker", runtime: "claude-code" });
    return rig;
  }

  function launcher(tmux: TmuxAdapter, admission?: LaunchAdmission) {
    return new NodeLauncher({
      db,
      rigRepo,
      sessionRegistry,
      eventBus,
      tmuxAdapter: tmux,
      ...(admission ? { launchAdmission: admission } : {}),
    });
  }

  it("queues a second launch behind the first and starts it only after release", async () => {
    const rig = seedTwoNodes();
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let calls = 0;
    const createSession = async (): Promise<TmuxResult> => {
      calls += 1;
      if (calls === 1) await firstGate;
      return { ok: true };
    };
    const admission = new LaunchAdmissionQueue(() => ({
      enabled: true,
      maxConcurrent: 1,
      maxPerRig: 0,
      reservedInteractive: 0,
      queueTimeoutSeconds: 300,
    }));
    const nodeLauncher = launcher(mockTmuxAdapter({ createSession }), admission);

    const first = nodeLauncher.launchNode(rig.id, "dev1-impl");
    const second = nodeLauncher.launchNode(rig.id, "dev2-impl");

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toBe(1);
    expect(admission.snapshot()).toMatchObject({
      current: { global: 1 },
      queued: { total: 1, background: 1 },
    });

    releaseFirst();
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    expect(calls).toBe(2);
    expect(admission.snapshot().current.global).toBe(0);
    expect(admission.snapshot().peak.global).toBe(1);
  });

  it("does not start anything when admission times out", async () => {
    const rig = seedTwoNodes();
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let calls = 0;
    const createSession = async (): Promise<TmuxResult> => {
      calls += 1;
      if (calls === 1) await firstGate;
      return { ok: true };
    };
    const admission = new LaunchAdmissionQueue(() => ({
      enabled: true,
      maxConcurrent: 1,
      maxPerRig: 0,
      reservedInteractive: 0,
      queueTimeoutSeconds: 1,
    }));
    const nodeLauncher = launcher(mockTmuxAdapter({ createSession }), admission);

    const first = nodeLauncher.launchNode(rig.id, "dev1-impl");
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await nodeLauncher.launchNode(rig.id, "dev2-impl");
    expect(second).toMatchObject({ ok: false, code: "admission_timeout" });
    expect(calls).toBe(1);

    releaseFirst();
    await first;
    expect(admission.snapshot().current.global).toBe(0);
  }, 10_000);

  it("passes the caller's lane to the gate and releases the lease on every outcome", async () => {
    const rig = seedTwoNodes();
    const acquired: Array<{ rigId: string; lane?: string }> = [];
    const released: string[] = [];
    const admission: LaunchAdmission = {
      async acquire(input) {
        acquired.push(input);
        return {
          ok: true,
          leaseId: `lease-${acquired.length}`,
          rigId: input.rigId,
          lane: input.lane ?? "background",
          enforcedBy: "not_enforced",
          reason: "disabled",
          waitedMs: 0,
        } satisfies LaunchAdmissionResult;
      },
      release(leaseId) { released.push(leaseId); },
      snapshot: () => ({
        enabled: false, enforcedBy: "not_enforced",
        limits: { maxConcurrent: 0, maxPerRig: 0, reservedInteractive: 0, backgroundMaxConcurrent: Infinity, backgroundMaxPerRig: Infinity },
        current: { global: 0, byRig: {} }, peak: { global: 0, byRig: {}, queued: 0 },
        queued: { total: 0, interactive: 0, background: 0 },
      }),
    };
    const nodeLauncher = launcher(mockTmuxAdapter(), admission);

    const interactive = await nodeLauncher.launchNode(rig.id, "dev1-impl", { lane: "interactive" });
    const background = await nodeLauncher.launchNode(rig.id, "dev2-impl");
    expect(interactive.ok).toBe(true);
    expect(background.ok).toBe(true);
    expect(acquired.map((entry) => entry.lane)).toEqual(["interactive", "background"]);
    expect(released).toEqual(["lease-1", "lease-2"]);
  });

  it("without an injected gate, launch behaviour is unchanged (no counters, no queue)", async () => {
    const rig = seedTwoNodes();
    const nodeLauncher = launcher(mockTmuxAdapter());
    const result = await nodeLauncher.launchNode(rig.id, "dev1-impl");
    expect(result.ok).toBe(true);
  });
});
