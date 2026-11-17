/**
 * S9 — create the shared `FI-02` run bundle the frozen acceptance commands name.
 *
 *   OPENRIG_S9_FIXTURES=$(mktemp -d) \
 *     npx tsx packages/daemon/test/s9-drivers/provision-fixtures.ts [--json]
 *
 * Run this ONCE before the entry-residual AT block, with the SAME per-verification root
 * exported for the block itself. It writes only under `$OPENRIG_S9_FIXTURES`, never into
 * either repo, and it recreates the bundle from scratch so a leftover ticket cannot make
 * a later case pass. `FI-01`, `FI-01b` and `FI-03` need no setup: those drivers make
 * their own `mkdtemp` namespace (W-S8-12).
 *
 * S9-R-01: with the env unset there is nothing to provision into — this exits 2 with the
 * reason rather than silently using a shared /tmp directory.
 */
import { fileURLToPath } from "node:url";
import { FIXTURE_ROOT_ENV, fixtureRoot, provisionFi02 } from "./fixtures.js";

function main(argv: readonly string[]): number {
  const json = argv.includes("--json");
  const root = fixtureRoot();
  if (root === null) {
    const payload = {
      fixture: "FI-02",
      ok: false,
      error: {
        code: "fixture_root_unset",
        message: `${FIXTURE_ROOT_ENV} is unset; refusing to share a fixture root (S9-R-01)`,
        hint: `${FIXTURE_ROOT_ENV}=$(mktemp -d) npx tsx packages/daemon/test/s9-drivers/provision-fixtures.ts`,
      },
      rc: 2,
    };
    process.stdout.write(json ? `${JSON.stringify(payload)}\n` : `[FAIL] ${payload.error.message}\n`);
    return 2;
  }

  const { runDir, home } = provisionFi02();
  const workflowGroup = process.env.OPENRIG_WORKFLOW_GROUP;
  const nextStep = workflowGroup
    ? `cd ${JSON.stringify(workflowGroup)} && OPENRIG_S9_FIXTURES=${root} .venv/bin/python scripts/openrig_run.py start --run-dir FI-02 --dry-run --json`
    : "OPENRIG_WORKFLOW_GROUP is unset; set it to the workflow-group checkout before running scripts/openrig_run.py";
  const payload = {
    fixture: "FI-02",
    fixtureRoot: root,
    runDir,
    home,
    reload: `OPENRIG_S9_FIXTURES=${root}`,
    next: [
      nextStep,
      "then run the entry AT block with the same OPENRIG_S9_FIXTURES exported",
    ],
    rc: 0,
  };
  process.stdout.write(
    json
      ? `${JSON.stringify(payload)}\n`
      : `provisioned FI-02 at ${runDir}\n  home: ${home}\n  next: ${payload.next[0]}\n`,
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}

export { main };
