import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EntryGuardError,
  denialMessage,
  renderDenial,
  stripAllowDirect,
  type GuardOptions,
} from "../src/entry-guard.js";
import { checkEntry } from "@openrig-local/daemon/entry-guard";

const roots: string[] = [];

function managedHome(): string {
  const home = mkdtempSync(join(tmpdir(), "openrig-s8-error-"));
  roots.push(home);
  mkdirSync(join(home, "entry"), { recursive: true });
  writeFileSync(
    join(home, "entry", "managed-run.json"),
    JSON.stringify({ schemaVersion: 1, runId: "run-1" }),
  );
  return home;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("EntryGuardError", () => {
  it("carries the guard code and exit code 2", () => {
    const error = new EntryGuardError("entry_guard_denied", "denied");
    expect(error.name).toBe("EntryGuardError");
    expect(error.code).toBe("entry_guard_denied");
    expect(error.exitCode).toBe(2);
    expect(error.message).toBe("denied");
  });
});

describe("stripAllowDirect", () => {
  it("keeps argv[0..1] and removes the flag before the command", () => {
    const result = stripAllowDirect(["node", "/rig", "--allow-direct", "up", "x"]);
    expect(result.argv).toEqual(["node", "/rig", "up", "x"]);
    expect(result.allowDirect).toBe(true);
  });

  it("removes the flag after the command and keeps the tail order", () => {
    const result = stripAllowDirect(["node", "/rig", "up", "x", "--allow-direct", "--plan"]);
    expect(result.argv).toEqual(["node", "/rig", "up", "x", "--plan"]);
    expect(result.allowDirect).toBe(true);
  });

  it("carries --allow-direct-reason without leaving it in argv", () => {
    const result = stripAllowDirect([
      "node",
      "/rig",
      "up",
      "x",
      "--allow-direct",
      "--allow-direct-reason",
      "hotfix",
    ]);
    expect(result.argv).toEqual(["node", "/rig", "up", "x"]);
    expect(result.allowDirectReason).toBe("hotfix");
  });

  it("does not strip after --", () => {
    const result = stripAllowDirect(["node", "/rig", "up", "x", "--", "--allow-direct"]);
    expect(result.argv).toEqual(["node", "/rig", "up", "x", "--", "--allow-direct"]);
    expect(result.allowDirect).toBe(false);
  });
});

describe("renderDenial", () => {
  const home = () => managedHome();

  it("emits the exact JSON error shape on stdout", () => {
    const write = home();
    const decision = checkEntry({ argv: ["daemon", "start"], home: write, env: {} });
    const out: string[] = [];
    const err: string[] = [];
    const code = renderDenial(
      decision,
      { argv: ["node", "/rig", "daemon", "start", "--json"], home: write },
      { out: (line) => out.push(line), err: (line) => err.push(line) },
    );
    expect(code).toBe(2);
    expect(err).toEqual([]);
    expect(out).toHaveLength(1);
    const parsed = JSON.parse(out[0]!);
    expect(parsed).toEqual({
      ok: false,
      error: {
        code: "entry_guard_denied",
        message: expect.stringContaining("openrig-run start --run-dir"),
      },
    });
    expect(parsed.error.message).toContain("entry guard denied");
  });

  it("emits four human lines on stderr", () => {
    const write = home();
    const decision = checkEntry({ argv: ["up", "spec.yaml"], home: write, env: {} });
    const out: string[] = [];
    const err: string[] = [];
    const code = renderDenial(
      decision,
      { argv: ["node", "/rig", "up", "spec.yaml"], home: write },
      { out: (line) => out.push(line), err: (line) => err.push(line) },
    );
    expect(code).toBe(2);
    expect(out).toEqual([]);
    expect(err).toHaveLength(4);
    expect(err[0]).toContain("entry guard denied");
    expect(err[1]).toContain("entry_guard_denied");
    expect(err[2]).toContain("openrig-run start --run-dir");
    expect(err[3]).toContain("openrig-run next --run-dir");
  });

  it("keeps the code and hint in the shared one-line message", () => {
    const write = home();
    const decision = checkEntry({ argv: ["daemon", "start"], home: write, env: {} });
    const message = denialMessage(decision, write);
    expect(message).toContain("entry_guard_denied");
    expect(message).toContain("openrig-run start --run-dir");
    expect(message).toContain(write);
  });
});

describe("guard option plumbing", () => {
  it("accepts the documented GuardOptions shape", () => {
    const options: GuardOptions = { home: "/tmp/x", env: {}, allowDirect: false };
    expect(options.home).toBe("/tmp/x");
  });
});
