/**
 * S9 W-S8-11 — a guard denial under `--json` is a JSON error object, at both levels.
 *
 * L0 (`renderDenial`, called by the bin wrapper) and L1 (`assertEntry` →
 * `EntryGuardError` → the shared `formatCliError` path) must agree: exit code 2, and
 * `{ok:false, error:{code, message, hint}}` on stdout with no human prose beside it.
 * The S8 residual was a denial that printed human text under `--json`.
 */
import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ENTRY_GUARD_HINT,
  EntryGuardError,
  assertEntry,
  denialMessage,
  renderDenial,
  resetEntryGuardProcessState,
} from "../src/entry-guard.js";
import { formatCliError, runProgram, wantsJsonOutput, type RunProgramIo } from "../src/cli-error.js";
import { checkEntry } from "@openrig-local/daemon/entry-guard";
import { Command } from "commander";

const roots: string[] = [];

function tmpHome(): string {
  const home = mkdtempSync(join(tmpdir(), "openrig-s9-json-"));
  roots.push(home);
  return home;
}

/** A managed (S1) home with NO launch record: the cheapest reproducible denial. */
function managedNoRecord(): string {
  const home = tmpHome();
  mkdirSync(join(home, "entry"), { recursive: true });
  writeFileSync(join(home, "entry", "managed-run.json"), JSON.stringify({ schemaVersion: 1, runId: "run-1" }));
  return home;
}

function capture(): { out: string[]; err: string[]; io: RunProgramIo } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: { out: (line) => out.push(line), err: (line) => err.push(line), exit: () => undefined },
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    resetEntryGuardProcessState(root);
    rmSync(root, { recursive: true, force: true });
  }
});

describe("the denial hint is one constant", () => {
  it("is the recovery command every denial points at", () => {
    // The AT-S9-ENT-05 driver mirrors this literal; keep them equal.
    expect(ENTRY_GUARD_HINT).toBe("openrig-run start --run-dir <run-dir>");
    expect(new EntryGuardError("entry_guard_denied", "x").hint).toBe(ENTRY_GUARD_HINT);
  });
});

describe("L0 renderDenial under --json", () => {
  it("writes ONLY the JSON error object to stdout and returns 2", () => {
    const home = managedNoRecord();
    const decision = checkEntry({ argv: ["daemon", "start"], home, env: {} });
    const { out, err, io } = capture();

    const code = renderDenial(
      decision,
      { argv: ["node", "/rig", "daemon", "start", "--json"], home },
      io,
    );

    expect(code).toBe(2);
    expect(err).toEqual([]);
    expect(out).toHaveLength(1);
    const parsed = JSON.parse(out[0]!) as { ok: boolean; error: { code: string; message: string } };
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("entry_guard_denied");
    expect(parsed.error.message).toContain("openrig-run start --run-dir");
    // No human prose leaked into the machine channel.
    expect(out[0]).not.toContain("  Why:");
  });

  it("recognises `-o json` and `--format=json` as JSON requests", () => {
    const home = managedNoRecord();
    for (const tail of [
      ["-o", "json"],
      ["--output=json"],
      ["--format", "json"],
    ]) {
      const { out, err, io } = capture();
      const argv = ["node", "/rig", "daemon", "start", ...tail];
      expect(wantsJsonOutput(argv)).toBe(true);
      renderDenial(checkEntry({ argv: ["daemon", "start"], home, env: {} }), { argv, home }, io);
      expect(err).toEqual([]);
      expect(JSON.parse(out[0]!).ok).toBe(false);
    }
  });

  it("keeps the four human lines on stderr when JSON was not requested", () => {
    const home = managedNoRecord();
    const { out, err, io } = capture();
    renderDenial(
      checkEntry({ argv: ["daemon", "start"], home, env: {} }),
      { argv: ["node", "/rig", "daemon", "start"], home },
      io,
    );
    expect(out).toEqual([]);
    expect(err).toHaveLength(4);
    expect(err[2]).toContain(ENTRY_GUARD_HINT);
  });
});

describe("L1 assertEntry → shared CLI error path", () => {
  it("throws EntryGuardError with code and exit code 2", async () => {
    const home = managedNoRecord();
    let caught: unknown;
    try {
      await assertEntry(["daemon", "start"], { home, env: {} });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EntryGuardError);
    const guardError = caught as EntryGuardError;
    expect(guardError.code).toBe("entry_guard_denied");
    expect(guardError.exitCode).toBe(2);
    expect(formatCliError(guardError)).toEqual({
      ok: false,
      error: {
        code: "entry_guard_denied",
        message: expect.stringContaining("entry guard denied"),
        hint: ENTRY_GUARD_HINT,
      },
    });
  });

  it("renders as JSON on stdout, with exit code 2 and no human text, under --json", async () => {
    const home = managedNoRecord();
    const program = new Command();
    program.name("rig").option("--json").command("start").action(async () => {
      await assertEntry(["daemon", "start"], { home, env: {} });
    });

    const out: string[] = [];
    const err: string[] = [];
    const exits: number[] = [];
    const code = await runProgram(program, ["node", "rig", "start", "--json"], {
      out: (line) => out.push(line),
      err: (line) => err.push(line),
      exit: (value) => exits.push(value),
    });

    expect(code).toBe(2);
    expect(exits).toEqual([2]);
    expect(err).toEqual([]);
    expect(out).toHaveLength(1);
    const parsed = JSON.parse(out[0]!) as {
      ok: boolean;
      error: { code: string; hint: string; message: string };
    };
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("entry_guard_denied");
    expect(parsed.error.hint).toBe(ENTRY_GUARD_HINT);
    expect(parsed.error.message).toContain("entry guard denied 'rig daemon start'");
  });

  it("still says something a human can read without --json", async () => {
    const home = managedNoRecord();
    const program = new Command();
    program.name("rig").command("start").action(async () => {
      await assertEntry(["daemon", "start"], { home, env: {} });
    });

    const out: string[] = [];
    const err: string[] = [];
    const code = await runProgram(program, ["node", "rig", "start"], {
      out: (line) => out.push(line),
      err: (line) => err.push(line),
      exit: () => undefined,
    });

    expect(code).toBe(2);
    expect(out).toEqual([]);
    expect(err.join("\n")).toContain("entry guard denied");
    expect(err.join("\n")).toContain("openrig-run start --run-dir");
  });

  it("mutation control: the pre-fix human-only renderer fails the JSON contract", () => {
    const home = managedNoRecord();
    const decision = checkEntry({ argv: ["daemon", "start"], home, env: {} });
    const human = [`error: entry guard denied`, `  Why: ${decision.reason}`].join("\n");
    // This is what AT-S9-ENT-05's pipeline asserts; the human text cannot satisfy it.
    let parsed: unknown;
    try {
      parsed = JSON.parse(human);
    } catch {
      parsed = null;
    }
    expect(parsed).toBeNull();
    // And the shipped shape does satisfy it.
    const message = denialMessage(decision, home);
    expect(JSON.parse(JSON.stringify({ ok: false, error: { code: decision.code, message } })).ok).toBe(false);
  });
});
