/**
 * S9 W-S8-14 driver — the guard side of "a dry run authorizes nothing".
 *
 *   npx tsx packages/daemon/test/s9-drivers/entry-guard-driver.ts \
 *     --home FI-02/home --verb daemon-start --json      # AT-S9-ENT-04
 *
 * AT-S9-ENT-03 runs `openrig_run.py start --dry-run` on the FI-02 fixture, which now
 * always closes its ticket (`phase=closed`, `dryRun:true`). This driver asks the guard
 * for `daemon-start` against the SAME home and must get rc 2 + `entry_guard_closed`.
 *
 * If the fixture bundle is absent the driver provisions a `phase=closed` ticket and says
 * so (`fixtureSeeded: true`) — an honest standalone check of the guard half. Run
 * `provision-fixtures.ts` (and AT-ENT-03) first to exercise the real artifact.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkEntry, readLaunchRecord, type EntryVerb } from "../../src/entry-guard.js";
import { provisionFi02, resolveFixturePath, writeLaunch, writeMarker } from "./fixtures.js";

const ENTRY_VERBS = new Set<string>([
  "daemon-start",
  "up",
  "restore-apply",
  "workflow-instantiate",
  "workflow-instantiate-lifecycle",
  "workflow-run",
]);

interface Args {
  home: string;
  verb: string;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { home: "FI-02/home", verb: "daemon-start" };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === "--home") args.home = argv[++i] ?? args.home;
    else if (token === "--verb") args.verb = argv[++i] ?? args.verb;
  }
  return args;
}

function emit(payload: Record<string, unknown>, rc: number): number {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  return rc;
}

function argvFor(verb: string): string[] {
  if (verb === "daemon-start") return ["daemon", "start"];
  return [verb];
}

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  if (!ENTRY_VERBS.has(args.verb)) {
    return emit({ error: `unknown entry verb '${args.verb}'`, rc: 2 }, 1);
  }

  let home = resolveFixturePath(args.home);
  let fixtureSeeded = false;
  let fixtureSource = "existing";
  // "Provisioned" means a TICKET exists, not merely a directory: provisionFi02() creates
  // <root>/FI-02/home without a launch record, and a bare directory classifies as an
  // unmanaged home (allow) — which silently made this row order-dependent on AT-ENT-03.
  // Seed whenever there is no launch record to judge; never overwrite one that exists.
  if (!existsSync(join(home, "entry", "launch.json"))) {
    let provisioned: { runDir: string; home: string };
    try {
      provisioned = provisionFi02();
    } catch (error) {
      // S9-R-01: no shared fallback. Fail with a code + hint, never a stack trace.
      return emit(
        {
          case: "dry-run-ticket-must-not-authorize",
          fixture: "FI-02",
          home,
          allow: false,
          code: "fixture_root_unset",
          error: error instanceof Error ? error.message : String(error),
          expected: "export OPENRIG_S9_FIXTURES=<per-verification dir> and provision FI-02",
          pass: false,
          rc: 2,
        },
        2,
      );
    }
    home = join(provisioned.home);
    fixtureSeeded = true;
    fixtureSource = "provisioned (no dry-run artifact present)";
  }

  // A seeded home must carry what a dry run leaves behind: a closed ticket that names
  // the home, plus the S1 marker. An existing home is used exactly as found.
  if (fixtureSeeded) {
    mkdirSync(join(home, "entry"), { recursive: true });
    writeMarker(home, "FI-02");
    writeLaunch(home, {
      launchId: "launch-fi02",
      runId: "FI-02",
      phase: "closed",
      dryRun: true,
    });
    writeFileSync(join(home, "entry", ".fixture-seeded"), "");
  }

  // Use the fixture's OWN token: the strongest form of "even the right token is refused
  // because the ticket is closed", and independent of the caller's environment.
  const launchId = readLaunchRecord(home).record?.launchId ?? "launch-fi02";
  const decision = checkEntry({
    argv: argvFor(args.verb),
    home,
    env: { OPENRIG_ENTRY_LAUNCH_ID: launchId },
  });

  const expected = decision.allow === false && decision.code === "entry_guard_closed";
  return emit(
    {
      case: "dry-run-ticket-must-not-authorize",
      fixture: "FI-02",
      home,
      verb: args.verb as EntryVerb,
      launchId,
      allow: decision.allow,
      code: decision.code,
      reason: decision.reason,
      fixtureSeeded,
      fixtureSource,
      expected: "deny + entry_guard_closed",
      pass: expected,
      rc: 2,
    },
    expected ? 2 : 1,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}

export { main };
