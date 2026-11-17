import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDaemonBoot, readLaunchRecord, type EntryVerb } from "../src/entry-guard.js";

const ALL_VERBS: EntryVerb[] = [
  "daemon-start",
  "up",
  "restore-apply",
  "workflow-instantiate",
  "workflow-instantiate-lifecycle",
  "workflow-run",
];

const roots: string[] = [];

function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "openrig-s8-boot-"));
  roots.push(dir);
  return dir;
}

function managedHome(launch?: Record<string, unknown> | null): string {
  const home = tmpDir();
  mkdirSync(join(home, "entry"), { recursive: true });
  writeFileSync(join(home, "entry", "managed-run.json"), JSON.stringify({ schemaVersion: 1, runId: "run-1" }));
  if (launch !== null) {
    writeFileSync(
      join(home, "entry", "launch.json"),
      JSON.stringify(
        launch ?? {
          schemaVersion: 1,
          launchId: "launch-boot",
          home,
          runId: "run-1",
          phase: "starting",
          expiresAt: "2999-01-01T00:00:00Z",
          verbs: ALL_VERBS,
          consumed: [],
        },
      ),
    );
  }
  return home;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("checkDaemonBoot", () => {
  it("allows a home without the managed-run marker", () => {
    const decision = checkDaemonBoot({ home: tmpDir(), env: {} });
    expect(decision.allow).toBe(true);
    expect(decision.homeKind).toBe("other");
  });

  it("allows an S2 run-shaped home without a marker", () => {
    const parent = tmpDir();
    const home = join(parent, "openrig-run-boot-fixture");
    mkdirSync(home, { recursive: true });
    const decision = checkDaemonBoot({ home, env: {} });
    expect(decision.allow).toBe(true);
    expect(decision.homeKind).toBe("run-shaped");
  });

  it("allows a fixture home even when a managed marker is present", () => {
    const home = managedHome();
    writeFileSync(join(home, ".openrig-fixture"), "");
    expect(checkDaemonBoot({ home, env: {} }).allow).toBe(true);
  });

  it("allows a managed home with a valid, unexpired record and matching token", () => {
    const home = managedHome();
    const decision = checkDaemonBoot({
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-boot" },
    });
    expect(decision.allow).toBe(true);
    expect(decision.reason).toContain("valid");
  });

  it("does not consume a verb at boot", () => {
    const home = managedHome();
    checkDaemonBoot({ home, env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-boot" } });
    expect(readLaunchRecord(home).record?.consumed).toEqual([]);
  });

  it("denies a managed home without a launch record", () => {
    const home = managedHome(null);
    const decision = checkDaemonBoot({ home, env: {} });
    expect(decision.allow).toBe(false);
    expect(decision.code).toBe("entry_guard_boot_denied");
  });

  it("denies an expired record at boot", () => {
    const home = managedHome();
    const record = readLaunchRecord(home).record!;
    writeFileSync(
      join(home, "entry", "launch.json"),
      JSON.stringify({ ...record, expiresAt: "2020-01-01T00:00:00Z" }),
    );
    const decision = checkDaemonBoot({
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-boot" },
    });
    expect(decision.code).toBe("entry_guard_boot_denied");
    expect(decision.reason).toContain("expired");
  });

  it("denies a token mismatch at boot", () => {
    const home = managedHome();
    const decision = checkDaemonBoot({ home, env: { OPENRIG_ENTRY_LAUNCH_ID: "other" } });
    expect(decision.code).toBe("entry_guard_boot_denied");
    expect(decision.reason).toContain("launchId");
  });

  it("denies a closed launch at boot", () => {
    const home = managedHome();
    const record = readLaunchRecord(home).record!;
    writeFileSync(join(home, "entry", "launch.json"), JSON.stringify({ ...record, phase: "closed" }));
    const decision = checkDaemonBoot({
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-boot" },
    });
    expect(decision.code).toBe("entry_guard_boot_denied");
    expect(decision.reason).toContain("closed");
  });

  it("denies a dry-run launch at boot", () => {
    const home = managedHome();
    const record = readLaunchRecord(home).record!;
    writeFileSync(
      join(home, "entry", "launch.json"),
      JSON.stringify({ ...record, phase: "starting", dryRun: true }),
    );
    const decision = checkDaemonBoot({
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-boot" },
    });
    expect(decision.allow).toBe(false);
    expect(decision.code).toBe("entry_guard_boot_denied");
    expect(decision.reason).toContain("dry run");
    expect(readFileSync(join(home, "entry", "audit.jsonl"), "utf8")).toContain(
      "entry_guard_boot_denied",
    );
  });

  it("still allows a real launch record with dryRun:false at boot", () => {
    const home = managedHome();
    const record = readLaunchRecord(home).record!;
    writeFileSync(
      join(home, "entry", "launch.json"),
      JSON.stringify({ ...record, dryRun: false }),
    );
    const decision = checkDaemonBoot({
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-boot" },
    });
    expect(decision.allow).toBe(true);
  });

  it("denies a record missing runId", () => {
    const home = managedHome();
    const record = readLaunchRecord(home).record!;
    const { runId: _drop, ...withoutRunId } = record;
    writeFileSync(join(home, "entry", "launch.json"), JSON.stringify(withoutRunId));
    const decision = checkDaemonBoot({
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-boot" },
    });
    expect(decision.code).toBe("entry_guard_boot_denied");
    expect(decision.reason).toContain("runId");
  });

  it("allows OPENRIG_ALLOW_DIRECT=1 and writes an audit line", () => {
    const home = managedHome(null);
    const decision = checkDaemonBoot({ home, env: { OPENRIG_ALLOW_DIRECT: "1" } });
    expect(decision.allow).toBe(true);
    const audit = readFileSync(join(home, "entry", "audit.jsonl"), "utf8");
    expect(audit).toContain("allow_override");
  });
});
