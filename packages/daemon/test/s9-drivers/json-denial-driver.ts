/**
 * S9 W-S8-11 driver — a guard denial under `--json` must be a JSON error object.
 *
 *   npx tsx packages/daemon/test/s9-drivers/json-denial-driver.ts --fixture FI-02
 *   npx tsx packages/daemon/test/s9-drivers/json-denial-driver.ts --fixture FI-02 \
 *     --mutation human-text                      # AT-S9-ENT-09
 *
 * AT-S9-ENT-05 pipes this driver into a JSON assertion, so stdout must be exactly what a
 * denied `rig … --json` prints. The renderer under test is the REAL shared CLI error path
 * (`formatCliError` from packages/cli/src), fed the REAL error contract the guard raises
 * (`code` + `exitCode: 2` + `hint`, the shape `EntryGuardError` carries). The full L1
 * path (`assertEntry` → `EntryGuardError`) is covered by
 * `packages/cli/test/entry-guard-json-denial.test.ts`; that test also pins the hint
 * constant this driver uses, so the two cannot drift apart silently.
 *
 * AT-S9-ENT-09 (mutation): `--mutation human-text` renders the pre-fix four-line human
 * text instead. The driver must then FAIL its own JSON assertion, which is the control
 * proving AT-ENT-05 is not vacuous. It exits 0 when the mutation is observed.
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkEntry } from "../../src/entry-guard.js";
import { formatCliError } from "../../../cli/src/cli-error.js";
import { provisionFi02, resolveFixturePath, writeLaunch, writeMarker } from "./fixtures.js";

/** Mirrors `ENTRY_GUARD_HINT` in packages/cli/src/entry-guard.ts (pinned by its test). */
const HINT = "openrig-run start --run-dir <run-dir>";

interface Args {
  fixture: string;
  mutation: string;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { fixture: "FI-02", mutation: "" };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === "--fixture") args.fixture = argv[++i] ?? args.fixture;
    else if (token === "--mutation") args.mutation = argv[++i] ?? "";
  }
  return args;
}

/** The error object the CLI's L1 path throws; `EntryGuardError` is this shape. */
function guardError(code: string, message: string): Error {
  return Object.assign(new Error(message), {
    name: "EntryGuardError",
    code,
    exitCode: 2,
    hint: HINT,
  });
}

/** `--fixture` accepts either a fixture NAME (`FI-02`, home at `<name>/home`) or a home
 *  path that already has an `entry/` directory. */
function resolveHomeArg(value: string): string {
  const asHome = resolveFixturePath(value);
  if (existsSync(join(asHome, "entry"))) return asHome;
  return resolveFixturePath(join(value, "home"));
}

/** The AT pipeline's own predicate: `ok===false && error && error.code`. */
function satisfiesJsonContract(text: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  const candidate = parsed as { ok?: unknown; error?: { code?: unknown } };
  return (
    candidate?.ok === false &&
    Boolean(candidate?.error) &&
    Boolean(candidate?.error?.code)
  );
}

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  let home = resolveHomeArg(args.fixture);
  // Same rule as entry-guard-driver: a directory is not a ticket. Seed only when there is
  // no launch record, so an existing artifact is always judged as-is.
  if (!existsSync(join(home, "entry", "launch.json"))) {
    let provisioned: { runDir: string; home: string };
    try {
      provisioned = provisionFi02();
    } catch (error) {
      process.stderr.write(
        `${JSON.stringify({
          ok: false,
          error: {
            code: "fixture_root_unset",
            message: error instanceof Error ? error.message : String(error),
            hint: "export OPENRIG_S9_FIXTURES=<per-verification dir>, then provision-fixtures.ts",
          },
        })}\n`,
      );
      return 2;
    }
    home = provisioned.home;
    mkdirSync(join(home, "entry"), { recursive: true });
    writeMarker(home, args.fixture);
    writeLaunch(home, {
      launchId: `launch-${args.fixture.toLowerCase()}`,
      runId: args.fixture,
      phase: "closed",
      dryRun: true,
    });
  }

  const decision = checkEntry({
    argv: ["daemon", "start"],
    home,
    env: { OPENRIG_ENTRY_LAUNCH_ID: process.env["OPENRIG_ENTRY_LAUNCH_ID"] ?? "launch-fi02" },
  });
  if (decision.allow) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, error: null, note: "fixture authorized the verb; denial not reachable" })}\n`,
    );
    return 1;
  }

  const code = decision.code ?? "entry_guard_denied";
  const message = `entry guard denied 'rig daemon start' on managed run home ${home}: ${decision.reason} (code: ${code}). Use: ${HINT}`;

  if (args.mutation === "human-text") {
    // Pre-fix behaviour: the human four-liner, no JSON on stdout at all.
    const human = [
      `error: entry guard denied 'rig daemon start' on managed run home ${home}`,
      `  Why: ${decision.reason} (code: ${code})`,
      `  Use: ${HINT}`,
      "  See: openrig-run next --run-dir <run-dir>",
    ].join("\n");
    process.stdout.write(`${human}\n`);
    // The mutation is OBSERVED when the JSON contract no longer holds.
    return satisfiesJsonContract(human) ? 1 : 0;
  }

  const rendered = formatCliError(guardError(code, message));
  process.stdout.write(`${JSON.stringify(rendered)}\n`);
  const contractHolds =
    rendered.ok === false &&
    typeof rendered.error.code === "string" &&
    rendered.error.code.length > 0 &&
    typeof rendered.error.hint === "string" &&
    rendered.error.hint.length > 0;
  return contractHolds ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}

export { main };
