/**
 * S9 W-S8-10 driver — atomic verb consumption, fail-closed writes, and the mutation
 * control that proves the concurrency case discriminates.
 *
 *   npx tsx packages/daemon/test/s9-drivers/atomic-token-driver.ts \
 *     --concurrency 12 --fixture FI-01 --json            # AT-S9-ENT-01, expects rc 0
 *   ... --case ledger-write-failure --fixture FI-01b --json  # AT-S9-ENT-02, expects rc 2
 *   ... --concurrency 12 --fixture FI-01 --mutation no-ledger --json  # AT-S9-ENT-08
 *
 * AT-S9-ENT-01: exactly one of N real OS processes may consume the verb; every other
 * one must be refused with `entry_guard_verb_consumed`. Real processes, not promises:
 * the S8 defect was a read-modify-write race across processes, which an in-process
 * test cannot reproduce.
 *
 * AT-S9-ENT-02: with the claim ledger unwritable, the guard must DENY with
 * `entry_guard_token_write_failed`. Nothing else is allowed to turn a failed write
 * into an allow (the S8 fail-open).
 *
 * AT-S9-ENT-08 (mutation): `--mutation no-ledger` runs the PRE-S9 algorithm in the same
 * children (read the record, sleep, rewrite `consumed[]`). It must let more than one
 * process through. If it does not, the concurrency case above is not proving anything
 * and this driver exits 1. The authoritative byte-level mutation (removing the claim
 * from `entry-guard.ts` with sed) belongs to N-VER-01; this is its fixture twin.
 *
 * Stdout is one JSON object. Exit codes: 0 expected-outcome, 1 assertion failed,
 * 2 the guarded call denied with the expected code (a deny is what AT-ENT-02 wants).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkEntry,
  readConsumedLedger,
  readLaunchRecord,
  type EntryVerb,
} from "../../src/entry-guard.js";
import { managedHome } from "./fixtures.js";

const VERB: EntryVerb = "daemon-start";
const TOKEN_ENV = "OPENRIG_ENTRY_LAUNCH_ID";

interface Args {
  concurrency: number;
  fixture: string;
  caseName: string;
  mutation: string;
  child: boolean;
  home: string;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    concurrency: 12,
    fixture: "FI-01",
    caseName: "",
    mutation: "",
    child: false,
    home: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === "--concurrency") args.concurrency = Number(argv[++i] ?? "12");
    else if (token === "--fixture") args.fixture = argv[++i] ?? args.fixture;
    else if (token === "--case") args.caseName = argv[++i] ?? "";
    else if (token === "--mutation") args.mutation = argv[++i] ?? "";
    else if (token === "--home") args.home = argv[++i] ?? "";
    else if (token === "--child") args.child = true;
  }
  return args;
}

interface ChildResult {
  allow: boolean;
  code: string | null;
  reason: string;
}

/** One real process attempting the same single-use token. */
function attemptInChild(home: string, launchId: string, mutation: string): Promise<ChildResult> {
  const script = fileURLToPath(import.meta.url);
  return new Promise<ChildResult>((resolve) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", script, "--child", "--home", home, "--mutation", mutation],
      {
        env: {
          ...process.env,
          [TOKEN_ENV]: launchId,
          OPENRIG_ENTRY_GUARD: "",
          OPENRIG_ALLOW_DIRECT: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      resolve({ allow: false, code: "child_spawn_failed", reason: String(error) });
    });
    child.on("close", (status) => {
      const line = stdout.trim().split("\n").filter(Boolean).pop();
      if (!line) {
        resolve({
          allow: false,
          code: "child_no_output",
          reason: `${stderr.trim() || "child produced no JSON"} (status=${String(status)})`,
        });
        return;
      }
      try {
        resolve(JSON.parse(line) as ChildResult);
      } catch {
        resolve({ allow: false, code: "child_bad_json", reason: line.slice(0, 200) });
      }
    });
  });
}

/**
 * The PRE-S9 consumption algorithm, reproduced faithfully: read the record, decide from
 * the array you read, then write. Between the read and the write every other process can
 * do the same, which is exactly why 12 of them all pass.
 */
function legacyAttempt(home: string, launchId: string): ChildResult {
  const read = readLaunchRecord(home);
  if (!read.ok || !read.record) {
    return { allow: false, code: read.code ?? "entry_guard_denied", reason: read.reason ?? "" };
  }
  const record = read.record;
  const consumed = record.consumed.some((c) => c.verb === VERB);
  if (consumed) {
    return { allow: false, code: "entry_guard_verb_consumed", reason: "already consumed" };
  }
  // A wide window: the pre-S9 code held this same read→write gap, and process startup
  // jitter must not hide it.
  const settle = Number(process.env["S9_LEGACY_RACE_MS"] ?? "600");
  const until = Date.now() + settle;
  while (Date.now() < until) {
    // busy-wait: hold the same window the real read-modify-write held
  }
  record.consumed.push({ verb: VERB, at: new Date().toISOString(), pid: process.pid });
  try {
    writeFileSync(join(home, "entry", "launch.json"), `${JSON.stringify(record, null, 2)}\n`);
  } catch (error) {
    return { allow: false, code: "entry_guard_denied", reason: String(error) };
  }
  return { allow: true, code: null, reason: `legacy allow for ${launchId}` };
}

function emit(payload: Record<string, unknown>, rc: number): number {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  return rc;
}

function runChild(args: Args): number {
  const launchId = process.env[TOKEN_ENV] ?? "";
  const result =
    args.mutation === "no-ledger" ? legacyAttempt(args.home, launchId) : attemptOnce(args.home, launchId);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.allow ? 0 : 2;
}

function attemptOnce(home: string, launchId: string): ChildResult {
  const decision = checkEntry({ argv: ["daemon", "start"], home, env: { [TOKEN_ENV]: launchId } });
  return { allow: decision.allow, code: decision.code, reason: decision.reason };
}

function ledgerWriteFailureCase(): number {
  const { home, launchId } = managedHome({ launchId: "launch-fi01b" });
  // Block the claim directory with a regular file: mkdir/claim both fail for every
  // user, root included, so the case does not depend on chmod semantics.
  mkdirSync(join(home, "entry"), { recursive: true });
  writeFileSync(join(home, "entry", "consumed"), "not a directory\n");

  const decision = checkEntry({
    argv: ["daemon", "start"],
    home,
    env: { [TOKEN_ENV]: launchId },
  });
  const expected = decision.code === "entry_guard_token_write_failed" && decision.allow === false;
  const payload = {
    case: "ledger-write-failure",
    fixture: "FI-01b",
    home,
    allow: decision.allow,
    code: decision.code,
    reason: decision.reason,
    ledgerLogWritten: existsSync(join(home, "entry", "consumed.jsonl")),
    expected: "deny + entry_guard_token_write_failed",
    pass: expected,
    rc: 2,
  };
  return emit(payload, expected ? 2 : 1);
}

async function concurrencyCase(args: Args): Promise<number> {
  const { home, launchId } = managedHome({ launchId: `launch-${args.fixture.toLowerCase()}` });
  const started = Date.now();
  // ALL children start before any of them finishes: spawnSync would serialize them and
  // prove nothing about a race.
  const results = await Promise.all(
    Array.from({ length: args.concurrency }, () => attemptInChild(home, launchId, args.mutation)),
  );
  const allowed = results.filter((r) => r.allow);
  const refused = results.filter((r) => !r.allow);
  const refusalCodes = [...new Set(refused.map((r) => r.code ?? "null"))];
  const ledger = [...readConsumedLedger(home, launchId)];
  const legacy = args.mutation === "no-ledger";

  const payload: Record<string, unknown> = {
    case: args.caseName || (legacy ? "mutation-no-ledger" : "concurrency"),
    fixture: args.fixture,
    home,
    concurrency: args.concurrency,
    allowed: allowed.length,
    refused: refused.length,
    refusalCodes,
    ledgerVerbs: ledger,
    elapsedMs: Date.now() - started,
  };

  if (legacy) {
    // The control: without the claim, the S8 read-modify-write race lets everyone in.
    payload.mutation = "no-ledger";
    payload.expected = "more than one process allowed (the defect must reproduce)";
    payload.pass = allowed.length > 1;
    return emit(payload, payload.pass === true ? 0 : 1);
  }

  payload.expected = "exactly 1 allowed; the rest refused with entry_guard_verb_consumed";
  payload.pass =
    allowed.length === 1 &&
    refused.length === args.concurrency - 1 &&
    refusalCodes.length === 1 &&
    refusalCodes[0] === "entry_guard_verb_consumed" &&
    ledger.length === 1 &&
    ledger[0] === VERB;
  return emit(payload, payload.pass === true ? 0 : 1);
}

async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);
  if (args.child) return runChild(args);
  if (args.caseName === "ledger-write-failure") return ledgerWriteFailureCase();
  if (args.caseName) {
    return emit({ case: args.caseName, error: `unknown case '${args.caseName}'`, rc: 2 }, 1);
  }
  return await concurrencyCase(args);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stdout.write(
        `${JSON.stringify({ error: error instanceof Error ? error.message : String(error), rc: 1 })}\n`,
      );
      process.exitCode = 1;
    });
}

export { main };
