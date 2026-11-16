import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { RigRepository } from "../src/domain/rig-repository.js";
import { SessionRegistry } from "../src/domain/session-registry.js";
import { EventBus } from "../src/domain/event-bus.js";
import { NodeLauncher } from "../src/domain/node-launcher.js";
import type { TmuxAdapter, TmuxResult } from "../src/adapters/tmux.js";
import { projectToolchainEnvironment } from "../src/domain/toolchain-environment.js";
import { createFullTestDb } from "./helpers/test-app.js";

function mockTmuxAdapter(onCreate?: (env?: Record<string, string>) => void): TmuxAdapter {
  return {
    createSession: async (_name: string, _cwd?: string, env?: Record<string, string>): Promise<TmuxResult> => {
      onCreate?.(env);
      return { ok: true as const };
    },
    killSession: async () => ({ ok: true as const }),
    listSessions: async () => [],
    listWindows: async () => [],
    listPanes: async () => [],
    hasSession: async () => false,
    sendText: async () => ({ ok: true as const }),
    sendKeys: async () => ({ ok: true as const }),
  } as unknown as TmuxAdapter;
}

describe("NodeLauncher toolchain environment projection", () => {
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

  function seed(runtime = "claude-code") {
    const rig = rigRepo.createRig("r01");
    rigRepo.addNode(rig.id, "dev1-impl", { role: "worker", runtime });
    return rig;
  }

  function launcher(
    tmux: TmuxAdapter,
    extra: { toolchainEnvironment?: () => Record<string, string>; sessionEnv?: Record<string, string> } = {},
  ) {
    return new NodeLauncher({
      db, rigRepo, sessionRegistry, eventBus, tmuxAdapter: tmux, ...extra,
    });
  }

  it("injects the projected variables into the seat's launch environment only", async () => {
    const rig = seed();
    let captured: Record<string, string> | undefined;
    const nodeLauncher = launcher(mockTmuxAdapter((env) => { captured = env; }), {
      toolchainEnvironment: () => projectToolchainEnvironment({ enabled: true, jobs: 3 }),
    });

    const result = await nodeLauncher.launchNode(rig.id, "dev1-impl");
    expect(result.ok).toBe(true);
    expect(captured).toMatchObject({
      CARGO_BUILD_JOBS: "3",
      RUST_TEST_THREADS: "3",
      MAKEFLAGS: "-j3",
      CMAKE_BUILD_PARALLEL_LEVEL: "3",
      UV_CONCURRENT_BUILDS: "3",
      NPM_CONFIG_JOBS: "3",
      UV_THREADPOOL_SIZE: "3",
      OPENRIG_NODE_ID: expect.any(String),
    });
  });

  it("leaves a pre-existing value in place (no override of the operator's env)", async () => {
    const rig = seed();
    let captured: Record<string, string> | undefined;
    const nodeLauncher = launcher(mockTmuxAdapter((env) => { captured = env; }), {
      sessionEnv: { CARGO_BUILD_JOBS: "99" },
      toolchainEnvironment: () => projectToolchainEnvironment({ enabled: true, jobs: 3 }),
    });

    expect((await nodeLauncher.launchNode(rig.id, "dev1-impl")).ok).toBe(true);
    expect(captured?.CARGO_BUILD_JOBS).toBe("99");
    expect(captured?.RUST_TEST_THREADS).toBe("3");
  });

  it("adds nothing when the projection is disabled or absent", async () => {
    const rig = seed();
    let captured: Record<string, string> | undefined;
    const nodeLauncher = launcher(mockTmuxAdapter((env) => { captured = env; }), {
      toolchainEnvironment: () => projectToolchainEnvironment({ enabled: false, jobs: 8 }),
    });
    expect((await nodeLauncher.launchNode(rig.id, "dev1-impl")).ok).toBe(true);
    expect(captured).not.toHaveProperty("CARGO_BUILD_JOBS");
    expect(captured).not.toHaveProperty("MAKEFLAGS");
  });

  it("does not fail the launch when the projection resolver throws", async () => {
    const rig = seed();
    let captured: Record<string, string> | undefined;
    const nodeLauncher = launcher(mockTmuxAdapter((env) => { captured = env; }), {
      toolchainEnvironment: () => { throw new Error("settings unavailable"); },
    });
    expect((await nodeLauncher.launchNode(rig.id, "dev1-impl")).ok).toBe(true);
    expect(captured).not.toHaveProperty("CARGO_BUILD_JOBS");
    expect(captured?.OPENRIG_NODE_ID).toEqual(expect.any(String));
  });
});
