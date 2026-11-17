import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon } from "../src/daemon-lifecycle.js";
import { EntryGuardError, resetEntryGuardProcessState } from "../src/entry-guard.js";

const roots: string[] = [];
const originalHome = process.env["OPENRIG_HOME"];
const originalToken = process.env["OPENRIG_ENTRY_LAUNCH_ID"];

function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "openrig-s8-startdaemon-"));
  roots.push(dir);
  return dir;
}

function useHome(home: string): void {
  process.env["OPENRIG_HOME"] = home;
  resetEntryGuardProcessState(home);
}

function managedNoRecord(): string {
  const home = tmpDir();
  mkdirSync(join(home, "entry"), { recursive: true });
  writeFileSync(
    join(home, "entry", "managed-run.json"),
    JSON.stringify({ schemaVersion: 1, runId: "run-1" }),
  );
  return home;
}

function managedWithRecord(): string {
  const home = tmpDir();
  mkdirSync(join(home, "entry"), { recursive: true });
  writeFileSync(
    join(home, "entry", "managed-run.json"),
    JSON.stringify({ schemaVersion: 1, runId: "run-1" }),
  );
  writeFileSync(
    join(home, "entry", "launch.json"),
    JSON.stringify({
      schemaVersion: 1,
      launchId: "launch-l1",
      home,
      runId: "run-1",
      phase: "starting",
      expiresAt: "2999-01-01T00:00:00Z",
      verbs: ["daemon-start", "up"],
      consumed: [],
    }),
  );
  return home;
}

function minimalDeps(lock: () => { release: () => void }): Record<string, unknown> {
  return {
    acquireStartLock: lock,
    spawn: vi.fn(() => {
      throw new Error("spawn must not run before the guard passes");
    }),
    fetch: vi.fn(async () => ({ ok: false } as Response)),
    kill: vi.fn(() => false),
    readFile: vi.fn(() => null),
    writeFile: vi.fn(),
    removeFile: vi.fn(),
    exists: vi.fn(() => false),
    mkdirp: vi.fn(),
    openForAppend: vi.fn(() => 0),
    isProcessAlive: vi.fn(() => false),
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    resetEntryGuardProcessState(root);
    rmSync(root, { recursive: true, force: true });
  }
  if (originalHome === undefined) delete process.env["OPENRIG_HOME"];
  else process.env["OPENRIG_HOME"] = originalHome;
  if (originalToken === undefined) delete process.env["OPENRIG_ENTRY_LAUNCH_ID"];
  else process.env["OPENRIG_ENTRY_LAUNCH_ID"] = originalToken;
});

describe("startDaemon L1 assertion", () => {
  it("denies a managed home without a record before acquiring the start lock", async () => {
    useHome(managedNoRecord());
    const lock = vi.fn(() => ({ release: vi.fn() }));
    const deps = minimalDeps(lock);

    await expect(
      startDaemon({}, deps as unknown as Parameters<typeof startDaemon>[1]),
    ).rejects.toBeInstanceOf(EntryGuardError);
    expect(lock).not.toHaveBeenCalled();
    expect(deps.spawn).not.toHaveBeenCalled();
  });

  it("carries code and exit code 2 on the denial", async () => {
    useHome(managedNoRecord());
    const deps = minimalDeps(vi.fn(() => ({ release: vi.fn() })));
    try {
      await startDaemon({}, deps as unknown as Parameters<typeof startDaemon>[1]);
      expect.fail("startDaemon should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(EntryGuardError);
      const guard = error as EntryGuardError;
      expect(guard.code).toBe("entry_guard_denied");
      expect(guard.exitCode).toBe(2);
      expect(guard.message).toContain("openrig-run start");
    }
  });

  it("denies a foreign token before acquiring the lock", async () => {
    useHome(managedWithRecord());
    process.env["OPENRIG_ENTRY_LAUNCH_ID"] = "launch-other";
    const lock = vi.fn(() => ({ release: vi.fn() }));
    const deps = minimalDeps(lock);
    await expect(
      startDaemon({}, deps as unknown as Parameters<typeof startDaemon>[1]),
    ).rejects.toMatchObject({ code: "entry_guard_token_mismatch" });
    expect(lock).not.toHaveBeenCalled();
  });

  it("reaches the start lock on a non-run home", async () => {
    useHome(tmpDir());
    const lock = vi.fn(() => {
      throw new Error("lock-reached");
    });
    const deps = minimalDeps(lock);
    await expect(
      startDaemon({}, deps as unknown as Parameters<typeof startDaemon>[1]),
    ).rejects.toThrow("lock-reached");
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it("reaches the start lock on a fixture home", async () => {
    const home = tmpDir();
    writeFileSync(join(home, ".openrig-fixture"), "");
    useHome(home);
    const lock = vi.fn(() => {
      throw new Error("lock-reached");
    });
    const deps = minimalDeps(lock);
    await expect(
      startDaemon({}, deps as unknown as Parameters<typeof startDaemon>[1]),
    ).rejects.toThrow("lock-reached");
  });

  it("reaches the start lock with a valid record and matching token", async () => {
    useHome(managedWithRecord());
    process.env["OPENRIG_ENTRY_LAUNCH_ID"] = "launch-l1";
    const lock = vi.fn(() => {
      throw new Error("lock-reached");
    });
    const deps = minimalDeps(lock);
    await expect(
      startDaemon({}, deps as unknown as Parameters<typeof startDaemon>[1]),
    ).rejects.toThrow("lock-reached");
    expect(lock).toHaveBeenCalledTimes(1);
  });
});
