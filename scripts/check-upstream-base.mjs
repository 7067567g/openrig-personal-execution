#!/usr/bin/env node
// Validate the root UPSTREAM-BASE lineage record (r15 §3).
//
// The file is the single source of truth for "which upstream is this tree based on and what has
// been taken". Its one invariant that a version bump can silently break is `local_line`: every
// package on the local line must carry the same version, and that version must be the one the
// record claims. Keeping this as a test in `npm run test:repo` makes "bump the version and forget
// UPSTREAM-BASE" a red gate instead of a stale record.
//
// Usage: node scripts/check-upstream-base.mjs [repo-root]
// The pure helpers are exported for scripts/check-upstream-base.test.mjs.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

/** Package files that must carry the local line's version (r15 §2.1). */
export const LOCAL_LINE_PACKAGES = [
  "package.json",
  "packages/cli/package.json",
  "packages/daemon/package.json",
  "packages/ui/package.json",
  "packages/tui/package.json",
];

export const REQUIRED_KEYS = [
  "schema",
  "local_line",
  "local_line_started",
  "upstream_repo",
  "upstream_baseline_release_tag",
  "upstream_baseline_release_commit",
  "fork_base_commit",
  "fork_base_date",
  "fork_base_note",
  "upstream_release_tag",
  "upstream_release_commit",
  "upstream_snapshot_commit",
  "upstream_snapshot_date",
  "sync_date",
  "sync_basis",
  "sync_scope",
  "sync_policy",
  "history_model",
  "absorbed_through",
  "integration_surface",
  "fork_model",
  "upstream_role",
  "version_line_policy",
  "sync_cadence",
  "integration_model",
];

/** r19 fork policy: these are decisions, not free text. A silent edit must fail the gate. */
const POLICY_VALUES = {
  fork_model: "independent-local-line",
  upstream_role: "read-only-reference",
  integration_model: "manual-backport-of-selected-commits",
};

const COMMIT_KEYS = [
  "upstream_baseline_release_commit",
  "fork_base_commit",
  "upstream_release_commit",
  "upstream_snapshot_commit",
  "absorbed_through",
];
const DATE_KEYS = ["local_line_started", "fork_base_date", "upstream_snapshot_date", "sync_date"];
const HEX40 = /^[0-9a-f]{40}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SYNC_BASIS = /^([0-9a-f]{40})\.\.([0-9a-f]{40})$/;
// Format: taken_commit=<40-hex> <YYYY-MM-DD> <PR-or-UNRELEASED> <short subject>
const TAKEN_COMMIT = /^([0-9a-f]{40}) (\d{4}-\d{2}-\d{2}) (#\d+|UNRELEASED) \S.*$/;

/**
 * Parse the record. Comments and blank lines are ignored; values keep everything after the FIRST
 * '=' (fork_base_note and sync_basis contain spaces). `taken_commit` is repeatable and collected
 * in order; every other key is single-valued and a later occurrence replaces an earlier one.
 */
export function parseUpstreamBase(text) {
  const values = new Map();
  const taken = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return;
    const eq = line.indexOf("=");
    if (eq <= 0) throw new Error(`line ${index + 1}: expected key=value`);
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === "taken_commit") taken.push({ value, line: index + 1 });
    else values.set(key, value);
  });
  return { values, taken };
}

/** Read the five package versions/private flags the record must agree with. */
export function readLocalPackages(repo = REPO) {
  return Object.fromEntries(
    LOCAL_LINE_PACKAGES.map((rel) => {
      const pkg = JSON.parse(readFileSync(path.join(repo, rel), "utf8"));
      return [rel, { version: pkg.version, private: pkg.private === true }];
    }),
  );
}

/** Validate a record's text against the packages in `repo`. Returns a list of human-readable errors. */
export function validateUpstreamBase({ text, repo = REPO }) {
  const errors = [];
  let parsed;
  try {
    parsed = parseUpstreamBase(text);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const { values, taken } = parsed;

  for (const key of REQUIRED_KEYS) {
    if (!values.get(key)) errors.push(`missing required key: ${key}`);
  }
  if (values.get("schema") !== "1") errors.push(`schema must be 1, got ${JSON.stringify(values.get("schema"))}`);
  for (const key of COMMIT_KEYS) {
    const value = values.get(key);
    if (value && !HEX40.test(value)) errors.push(`${key} must be a 40-hex commit, got ${JSON.stringify(value)}`);
  }
  for (const key of DATE_KEYS) {
    const value = values.get(key);
    if (value && !ISO_DATE.test(value)) errors.push(`${key} must be YYYY-MM-DD, got ${JSON.stringify(value)}`);
  }
  const basis = values.get("sync_basis");
  if (basis && !SYNC_BASIS.test(basis)) errors.push(`sync_basis must be <40-hex>..<40-hex>, got ${JSON.stringify(basis)}`);
  if (values.get("fork_base_note") && values.get("fork_base_note").length < 20) {
    errors.push("fork_base_note must explain the fork point, not just name it");
  }
  for (const [key, expected] of Object.entries(POLICY_VALUES)) {
    const value = values.get(key);
    if (value && value !== expected) {
      errors.push(`${key} must be ${JSON.stringify(expected)} for the r19 fork policy, got ${JSON.stringify(value)}`);
    }
  }
  for (const key of ["version_line_policy", "sync_cadence"]) {
    const value = values.get(key);
    if (value && value.length < 20) errors.push(`${key} must state the policy, not just a word`);
  }

  const surface = values.get("integration_surface");
  if (surface) {
    for (const rel of surface.split(",").map((entry) => entry.trim()).filter(Boolean)) {
      if (!existsSync(path.join(repo, rel))) errors.push(`integration_surface file does not exist: ${rel}`);
    }
  }

  taken.forEach(({ value, line }) => {
    if (!TAKEN_COMMIT.test(value)) errors.push(`line ${line}: taken_commit must be "<40-hex> <YYYY-MM-DD> <#PR|UNRELEASED> <subject>"`);
  });

  if (values.get("local_line")) {
    const packages = readLocalPackages(repo);
    const rootVersion = packages["package.json"]?.version;
    const mismatched = Object.entries(packages)
      .filter(([, pkg]) => pkg.version !== values.get("local_line"))
      .map(([rel, pkg]) => `${rel}=${pkg.version}`);
    if (rootVersion !== values.get("local_line")) {
      errors.push(`local_line=${values.get("local_line")} but package.json=${rootVersion}`);
    }
    if (mismatched.length > 0) {
      errors.push(`packages off the declared local line: ${mismatched.join(", ")}`);
    }
    if (packages["packages/tui/package.json"]?.private !== true) {
      errors.push("packages/tui/package.json must stay private");
    }
  }
  return errors;
}

/** Convenience for the CLI: validate the checked-in record. */
export function validateRepository(repo = REPO) {
  const file = path.join(repo, "UPSTREAM-BASE");
  if (!existsSync(file)) return { errors: ["UPSTREAM-BASE is missing at the repository root"], summary: null };
  const text = readFileSync(file, "utf8");
  const { values, taken } = parseUpstreamBase(text);
  return {
    errors: validateUpstreamBase({ text, repo }),
    summary: `local_line=${values.get("local_line")} fork_base=${values.get("fork_base_commit")} upstream=${values.get("upstream_release_tag")} taken=${taken.length}`,
  };
}

function main() {
  const repo = process.argv[2] ? path.resolve(process.argv[2]) : REPO;
  const { errors, summary } = validateRepository(repo);
  if (errors.length > 0) {
    console.error("UPSTREAM-BASE invalid:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[check-upstream-base] OK: ${summary}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
