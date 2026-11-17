/**
 * S9 Wave B entry-residual fixtures (W-S8-12: one namespace per case).
 *
 * The drivers are run directly with `npx tsx packages/daemon/test/s9-drivers/<x>.ts`
 * from the product repo root, so they import the daemon guard from SOURCE
 * (`../../src/entry-guard.js`) and never from `dist` — a stale build must not be able
 * to make a driver pass.
 *
 * Two kinds of fixture live here:
 *  - per-invocation homes under a fresh `mkdtemp` (FI-01, FI-01b, FI-03), so two
 *    verifiers can never erase each other (that was the S8 defect W-S8-12);
 *  - ONE intentional cross-invocation run dir (FI-02), because AT-S9-ENT-03..05,09 test
 *    a chain: `openrig_run.py start --dry-run` writes the ticket and the guard then has
 *    to refuse it. It lives under `$OPENRIG_S9_FIXTURES` (default /tmp/openrig-s9-fixtures)
 *    and `provision-fixtures.ts` recreates it from scratch before the chain runs.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const ALL_VERBS = [
  "daemon-start",
  "up",
  "restore-apply",
  "workflow-instantiate",
  "workflow-instantiate-lifecycle",
  "workflow-run",
] as const;

/**
 * S9-R-01 — there is NO default fixture root.
 *
 * A shared `/tmp/openrig-s9-fixtures` fallback quietly re-created the W-S8-12 defect
 * (two verifiers overwriting each other's fixtures), so an unset `OPENRIG_S9_FIXTURES`
 * now means "cannot resolve", and every consumer fails with the coded error + the
 * provisioning hint instead of silently sharing state.
 */
export const FIXTURE_ROOT_ENV = "OPENRIG_S9_FIXTURES";

/** The per-verification fixture root, or null when the env is unset/blank. */
export function fixtureRoot(): string | null {
  const value = process.env[FIXTURE_ROOT_ENV]?.trim();
  return value ? resolve(value) : null;
}

const FIXTURE_NAME_RE = /^FI-[A-Za-z0-9_.-]+$/;

/** A fresh, isolated directory for one case (W-S8-12). */
export function isolatedDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `openrig-s9-${prefix}-`));
}

/** Write `<home>/entry/managed-run.json`. */
export function writeMarker(home: string, runId = "run-fi"): void {
  mkdirSync(join(home, "entry"), { recursive: true });
  writeFileSync(
    join(home, "entry", "managed-run.json"),
    `${JSON.stringify({ schemaVersion: 1, runId })}\n`,
  );
}

export interface LaunchOverrides {
  launchId?: string;
  runId?: string;
  phase?: "starting" | "active" | "closed";
  expiresAt?: string;
  verbs?: readonly string[];
  consumed?: Array<{ verb: string; at: string; pid: number }>;
  dryRun?: boolean;
  home?: string;
}

/** Write a complete launch record for `home`. */
export function writeLaunch(home: string, overrides: LaunchOverrides = {}): Record<string, unknown> {
  mkdirSync(join(home, "entry"), { recursive: true });
  const record = {
    schemaVersion: 1,
    launchId: overrides.launchId ?? "launch-fi",
    home: overrides.home ?? home,
    runId: overrides.runId ?? "run-fi",
    phase: overrides.phase ?? "starting",
    expiresAt: overrides.expiresAt ?? "2999-01-01T00:00:00Z",
    verbs: [...(overrides.verbs ?? ALL_VERBS)],
    consumed: overrides.consumed ?? [],
    ...(overrides.dryRun === true ? { dryRun: true } : {}),
  };
  writeFileSync(join(home, "entry", "launch.json"), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

/** A managed (S1) home with a live, valid launch record authorizing all six verbs. */
export function managedHome(overrides: LaunchOverrides = {}): { home: string; launchId: string } {
  const home = isolatedDir("home");
  writeMarker(home);
  const record = writeLaunch(home, overrides);
  return { home, launchId: String(record["launchId"]) };
}

/**
 * Resolve a `--home FI-02/home` style argument: an existing path wins; otherwise a
 * `FI-*`-named relative path is looked up under the fixture root. Anything else is
 * returned unchanged so the caller reports a plain missing path.
 */
export function resolveFixturePath(value: string): string {
  const direct = resolve(value);
  if (existsSync(direct)) return direct;
  const segments = value.split(/[\\/]/).filter((part) => part.length > 0);
  const head = segments[0];
  if (!head || !FIXTURE_NAME_RE.test(head)) return direct;
  const root = fixtureRoot();
  if (root === null) return direct; // S9-R-01: no shared default to fall back to
  const candidate = join(root, ...segments);
  return existsSync(candidate) ? candidate : direct;
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const FIXTURE_DOCTOR = `#!/usr/bin/env python3
"""S9 fixture doctor: proves the fixture bundle is readable; asserts nothing else."""
import json, sys
args = sys.argv[1:]
if args[:1] != ["doctor"]:
    print("fixture doctor: unsupported command", file=sys.stderr)
    sys.exit(2)
print("PASS fixture doctor (s9 FI-02)")
sys.exit(0)
`;

/**
 * Create (or recreate) the shared `FI-02` run bundle so the frozen AT commands work
 * verbatim. Deterministic and idempotent: the previous copy is removed first, so a
 * stale ticket can never make a later case pass.
 */
export function provisionFi02(): { runDir: string; home: string } {
  const root = fixtureRoot();
  if (root === null) {
    throw new Error(
      `${FIXTURE_ROOT_ENV} is unset: refusing to provision fixtures into a shared location ` +
        "(S9-R-01). Export it to a per-verification directory, e.g. " +
        `${FIXTURE_ROOT_ENV}=$(mktemp -d) npx tsx packages/daemon/test/s9-drivers/provision-fixtures.ts`,
    );
  }
  const runDir = join(root, "FI-02");
  rmSync(runDir, { recursive: true, force: true });
  const home = join(runDir, "home");
  const openrig = join(runDir, "openrig");
  mkdirSync(join(openrig, "tools"), { recursive: true });
  mkdirSync(home, { recursive: true });

  writeFileSync(join(openrig, "rig.yaml"), "rig: s9-fi02\n");
  writeFileSync(join(openrig, "workflow.yaml"), "workflow: s9-fi02\n");

  const files: Record<string, { bytes: number; sha256: string }> = {};
  for (const rel of ["rig.yaml", "workflow.yaml"]) {
    const path = join(openrig, rel);
    files[rel] = { bytes: readFileSync(path).byteLength, sha256: sha256File(path) };
  }
  writeFileSync(
    join(openrig, "render-manifest.json"),
    `${JSON.stringify({ schemaVersion: 1, runId: "FI-02", files }, null, 2)}\n`,
  );

  const doctor = join(openrig, "tools", "openrig_bridge.py");
  writeFileSync(doctor, FIXTURE_DOCTOR, { mode: 0o755 });

  const bridge = {
    schemaVersion: 2,
    runId: "FI-02",
    rigName: "s9-fi02",
    workflowId: "s9-fi02",
    rigSpec: "rig.yaml",
    workflowSpec: "workflow.yaml",
    openrigCli: "rig",
    openrigHome: home,
    projectRoot: join(runDir, "project-root"),
    daemonPort: 47997,
    seatMap: { main: "main@FI-02", tdo: "tdo@FI-02" },
    bundleDir: "openrig",
    _fixture: "S9 entry-residual fixture; not a real run",
  };
  writeFileSync(
    join(openrig, "OPENRIG-BRIDGE.json"),
    `${JSON.stringify(bridge, null, 2)}\n`,
  );
  return { runDir, home };
}
