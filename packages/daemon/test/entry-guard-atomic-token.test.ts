/**
 * S9 W-S8-10 — atomic verb consumption and fail-closed claim writes.
 *
 * The S8 defect had two halves: a read-modify-write `consumed[]` that 12 concurrent
 * processes could all pass, and a catch-all that turned a failed write into an allow.
 * These cases pin both: the ledger file is the gate, and every failure path denies.
 *
 * The 12-real-process race lives in `s9-drivers/atomic-token-driver.ts` (an in-process
 * test cannot race itself). Here each fixture is a fresh `mkdtemp` home (W-S8-12).
 */
import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CONSUMED_LEDGER_DIR,
  CONSUMED_LEDGER_LOG,
  ENTRY_VERBS,
  checkEntry,
  claimVerb,
  readConsumedLedger,
  readLaunchRecord,
  type EntryVerb,
} from "../src/entry-guard.js";

const ALL_VERBS: EntryVerb[] = [
  "daemon-start",
  "up",
  "restore-apply",
  "workflow-instantiate",
  "workflow-instantiate-lifecycle",
  "workflow-run",
];
const TOKEN = { OPENRIG_ENTRY_LAUNCH_ID: "launch-atomic" };

const roots: string[] = [];

function tmpHome(): string {
  const home = mkdtempSync(join(tmpdir(), "openrig-s9-atomic-"));
  roots.push(home);
  return home;
}

function managedHome(): string {
  const home = tmpHome();
  mkdirSync(join(home, "entry"), { recursive: true });
  writeFileSync(
    join(home, "entry", "managed-run.json"),
    JSON.stringify({ schemaVersion: 1, runId: "run-1" }),
  );
  writeFileSync(
    join(home, "entry", "launch.json"),
    JSON.stringify({
      schemaVersion: 1,
      launchId: "launch-atomic",
      home,
      runId: "run-1",
      phase: "starting",
      expiresAt: "2999-01-01T00:00:00Z",
      verbs: ALL_VERBS,
      consumed: [],
    }),
  );
  return home;
}

function daemonStart(home: string, env: Record<string, string> = TOKEN) {
  return checkEntry({ argv: ["daemon", "start"], home, env });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("claimVerb — the atomic gate (W-S8-10)", () => {
  it("lets the first claim through and refuses the second by name", () => {
    const home = managedHome();
    expect(claimVerb({ home, verb: "daemon-start", launchId: "launch-atomic" }).ok).toBe(true);

    const second = claimVerb({ home, verb: "daemon-start", launchId: "launch-atomic" });
    expect(second.ok).toBe(false);
    expect(second.code).toBe("entry_guard_verb_consumed");
    expect(second.reason).toContain("daemon-start");
  });

  it("claims each verb independently", () => {
    const home = managedHome();
    expect(claimVerb({ home, verb: "daemon-start", launchId: "launch-atomic" }).ok).toBe(true);
    expect(claimVerb({ home, verb: "up", launchId: "launch-atomic" }).ok).toBe(true);
    expect([...readConsumedLedger(home, "launch-atomic")].sort()).toEqual(["daemon-start", "up"]);
  });

  it("claims and reads every newly recognized lifecycle verb", () => {
    const home = managedHome();
    const newVerbs = ENTRY_VERBS.filter((verb) => !ALL_VERBS.includes(verb));
    expect(newVerbs.length).toBeGreaterThan(0);

    for (const verb of newVerbs) {
      expect(claimVerb({ home, verb, launchId: "launch-atomic" }).ok, verb).toBe(true);
    }

    expect([...readConsumedLedger(home, "launch-atomic")].sort()).toEqual([...newVerbs].sort());
    const claimDir = join(home, CONSUMED_LEDGER_DIR, "launch-atomic");
    expect(readdirSync(claimDir).sort()).toEqual([...newVerbs].sort());
  });

  it("is append-only: one claim file per verb and one ledger line, never rewritten", () => {
    const home = managedHome();
    claimVerb({ home, verb: "daemon-start", launchId: "launch-atomic", pid: 111 });
    claimVerb({ home, verb: "daemon-start", launchId: "launch-atomic", pid: 222 });

    const claimDir = join(home, CONSUMED_LEDGER_DIR, "launch-atomic");
    expect(readdirSync(claimDir)).toEqual(["daemon-start"]);
    const claim = JSON.parse(readFileSync(join(claimDir, "daemon-start"), "utf8")) as {
      verb: string;
      pid: number;
    };
    expect(claim.verb).toBe("daemon-start");
    expect(claim.pid).toBe(111);

    const lines = readFileSync(join(home, CONSUMED_LEDGER_LOG), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { verb: string });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.verb).toBe("daemon-start");
  });

  it("denies when the claim directory cannot be created", () => {
    const home = managedHome();
    writeFileSync(join(home, "entry", "consumed"), "not a directory\n");

    const claim = claimVerb({ home, verb: "daemon-start", launchId: "launch-atomic" });
    expect(claim.ok).toBe(false);
    expect(claim.code).toBe("entry_guard_token_write_failed");
  });

  it("denies when the ledger line cannot be appended and releases the provisional claim", () => {
    const home = managedHome();
    mkdirSync(join(home, CONSUMED_LEDGER_LOG), { recursive: true }); // EISDIR on append

    const claim = claimVerb({ home, verb: "daemon-start", launchId: "launch-atomic" });
    expect(claim.ok).toBe(false);
    expect(claim.code).toBe("entry_guard_token_write_failed");
    expect(claim.reason).toContain("ledger line");
    expect(claim.reason).toContain("released");
    expect(claim.tokenSpent).toBeUndefined();

    // S10 r3 denied-claim fix: a denied attempt must not silently spend the token.
    const claimPath = join(home, CONSUMED_LEDGER_DIR, "launch-atomic", "daemon-start");
    expect(existsSync(claimPath)).toBe(false);
    expect(readConsumedLedger(home, "launch-atomic").has("daemon-start")).toBe(false);

    // Once the mirror obstruction is gone, the same one-shot verb can be claimed.
    rmSync(join(home, CONSUMED_LEDGER_LOG), { recursive: true, force: true });
    expect(claimVerb({ home, verb: "daemon-start", launchId: "launch-atomic" }).ok).toBe(true);
    expect(readConsumedLedger(home, "launch-atomic").has("daemon-start")).toBe(true);
  });
});

describe("checkEntry — consumption is fail-closed (W-S8-10)", () => {
  it("allows once, mirrors the record, and denies a second independent use", () => {
    const home = managedHome();
    const first = daemonStart(home);
    expect(first.allow).toBe(true);
    expect(first.code).toBeNull();
    expect(existsSync(join(home, CONSUMED_LEDGER_DIR, "launch-atomic", "daemon-start"))).toBe(true);
    expect(readLaunchRecord(home).record?.consumed.map((c) => c.verb)).toContain("daemon-start");

    const second = daemonStart(home);
    expect(second.allow).toBe(false);
    expect(second.code).toBe("entry_guard_verb_consumed");
  });

  it("still allows a re-check inside the same process that already consumed it", () => {
    const home = managedHome();
    expect(daemonStart(home).allow).toBe(true);
    const inProcess = checkEntry({
      argv: ["daemon", "start"],
      home,
      env: TOKEN,
      alreadyConsumed: ["daemon-start"],
    });
    expect(inProcess.allow).toBe(true);
  });

  it("denies with entry_guard_token_write_failed — never fail-open — when the claim cannot be written", () => {
    const home = managedHome();
    writeFileSync(join(home, "entry", "consumed"), "not a directory\n");

    const decision = daemonStart(home);
    expect(decision.allow).toBe(false);
    expect(decision.code).toBe("entry_guard_token_write_failed");
    expect(decision.reason).toContain("ledger");
    // A failed claim cannot leave the token looking consumed or authorized.
    expect(readLaunchRecord(home).record?.consumed).toEqual([]);
  });

  it("does not spend the token when a denied claim released its provisional file", () => {
    const home = managedHome();
    const claimPath = join(home, CONSUMED_LEDGER_DIR, "launch-atomic", "daemon-start");
    mkdirSync(join(home, CONSUMED_LEDGER_LOG), { recursive: true }); // EISDIR on append

    const denied = daemonStart(home);
    expect(denied.allow).toBe(false);
    expect(denied.code).toBe("entry_guard_token_write_failed");
    expect(existsSync(claimPath)).toBe(false);

    // Clear the mirror obstruction; the legitimately denied attempt did not consume
    // the one-shot token, so the same live launch can still start exactly once.
    rmSync(join(home, CONSUMED_LEDGER_LOG), { recursive: true, force: true });
    const allowed = daemonStart(home);
    expect(allowed.allow).toBe(true);
    expect(readConsumedLedger(home, "launch-atomic").has("daemon-start")).toBe(true);
    expect(daemonStart(home).code).toBe("entry_guard_verb_consumed");
  });

  it("denies when the record mirror is the only evidence (pre-ledger records)", () => {
    const home = managedHome();
    const record = readLaunchRecord(home).record!;
    writeFileSync(
      join(home, "entry", "launch.json"),
      JSON.stringify({
        ...record,
        consumed: [{ verb: "daemon-start", at: "2026-01-01T00:00:00Z", pid: 1 }],
      }),
    );
    const decision = daemonStart(home);
    expect(decision.code).toBe("entry_guard_verb_consumed");
    // The ledger stayed untouched: a mirror-only denial never takes the token.
    expect(readConsumedLedger(home, "launch-atomic").has("daemon-start")).toBe(false);
  });

  it("mutation control: removing the claim AND the mirror re-opens the token", () => {
    const home = managedHome();
    expect(daemonStart(home).allow).toBe(true);

    // Drop the atomic claim only — the mirror still denies, so either mechanism suffices.
    rmSync(join(home, CONSUMED_LEDGER_DIR, "launch-atomic", "daemon-start"));
    expect(daemonStart(home).code).toBe("entry_guard_verb_consumed");

    // Drop the mirror too: with no gate left, the same call is allowed again. This is
    // what makes the two positive/negative cases above non-vacuous.
    const record = readLaunchRecord(home).record!;
    writeFileSync(join(home, "entry", "launch.json"), JSON.stringify({ ...record, consumed: [] }));
    const reopened = daemonStart(home);
    expect(reopened.allow).toBe(true);
    expect(readConsumedLedger(home, "launch-atomic").has("daemon-start")).toBe(true);
  });

  it("does not let one launch's claims deny the NEXT launch on the same home", () => {
    const home = managedHome();
    expect(daemonStart(home).allow).toBe(true);
    expect(daemonStart(home).code).toBe("entry_guard_verb_consumed");

    // A fresh `openrig-run start` writes a NEW launch record: a new authorization must be
    // usable, while the previous launch's ledger stays on disk as evidence.
    const record = readLaunchRecord(home).record!;
    writeFileSync(
      join(home, "entry", "launch.json"),
      JSON.stringify({ ...record, launchId: "launch-next", consumed: [] }),
    );
    const next = checkEntry({
      argv: ["daemon", "start"],
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-next" },
    });
    expect(next.allow).toBe(true);
    expect(readConsumedLedger(home, "launch-atomic").has("daemon-start")).toBe(true);
    expect(readConsumedLedger(home, "launch-next").has("daemon-start")).toBe(true);
  });

  it("does not consume anything when the decision is a deny (expired ticket)", () => {
    const home = managedHome();
    const record = readLaunchRecord(home).record!;
    writeFileSync(
      join(home, "entry", "launch.json"),
      JSON.stringify({ ...record, expiresAt: "2020-01-01T00:00:00Z" }),
    );
    const decision = daemonStart(home);
    expect(decision.code).toBe("entry_guard_expired");
    expect(readConsumedLedger(home, "launch-atomic").size).toBe(0);
    expect(existsSync(join(home, CONSUMED_LEDGER_DIR))).toBe(false);
  });
});

describe("checkEntry — dry-run records authorize nothing (W-S8-14)", () => {
  it("denies entry_guard_closed for dryRun:true even when the phase is still starting", () => {
    const home = managedHome();
    const record = readLaunchRecord(home).record!;
    writeFileSync(
      join(home, "entry", "launch.json"),
      JSON.stringify({ ...record, phase: "starting", dryRun: true }),
    );
    const decision = daemonStart(home);
    expect(decision.allow).toBe(false);
    expect(decision.code).toBe("entry_guard_closed");
    expect(decision.reason).toContain("dry run");
    expect(readConsumedLedger(home, "launch-atomic").size).toBe(0);
  });

  it("denies a closed dry-run record with the same code", () => {
    const home = managedHome();
    const record = readLaunchRecord(home).record!;
    writeFileSync(
      join(home, "entry", "launch.json"),
      JSON.stringify({ ...record, phase: "closed", dryRun: true }),
    );
    expect(daemonStart(home).code).toBe("entry_guard_closed");
  });
});
