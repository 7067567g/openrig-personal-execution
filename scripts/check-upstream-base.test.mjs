import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { LOCAL_LINE_PACKAGES, parseUpstreamBase, readLocalPackages, validateRepository, validateUpstreamBase } from "./check-upstream-base.mjs";

const REPO = path.resolve(import.meta.dirname, "..");
const RECORD = readFileSync(path.join(REPO, "UPSTREAM-BASE"), "utf8");
const validate = (text) => validateUpstreamBase({ text, repo: REPO });
const withLine = (line) => `${RECORD.trimEnd()}\n${line}\n`;

test("the checked-in UPSTREAM-BASE record is valid", () => {
  assert.deepEqual(validate(RECORD), []);
  const { errors, summary } = validateRepository(REPO);
  assert.deepEqual(errors, []);
  assert.match(summary, /^local_line=0.1.4 fork_base=[0-9a-f]{40} upstream=v0\.7\.0 taken=9$/);
});

test("every package on the local line carries the same version and tui stays private", () => {
  const packages = readLocalPackages(REPO);
  assert.deepEqual(Object.keys(packages), LOCAL_LINE_PACKAGES);
  const versions = new Set(Object.values(packages).map((pkg) => pkg.version));
  assert.deepEqual([...versions], ["0.1.4"]);
  assert.equal(packages["packages/tui/package.json"].private, true);
});

test("the record names v0.6.11, the real fork base, v0.7.0 and the sync date", () => {
  const { values } = parseUpstreamBase(RECORD);
  assert.equal(values.get("upstream_baseline_release_tag"), "v0.6.11");
  assert.equal(values.get("upstream_baseline_release_commit"), "379f0a0d106e65164c615818927267c2082ebcb4");
  assert.equal(values.get("fork_base_commit"), "eabc816e584af82be7f97c6269f2551883f569e3");
  assert.equal(values.get("upstream_release_tag"), "v0.7.0");
  assert.equal(values.get("upstream_release_commit"), "c99450f322646acd6bcd93e11a3bd1474f1d7751");
  assert.equal(values.get("sync_date"), "2026-10-24");
});

test("parser ignores comments and blank lines, splits at the first '=', and keeps the last duplicate", () => {
  const { values, taken } = parseUpstreamBase(
    ["# comment", "", "a=1", "note=x = y = z", "a=2", "taken_commit=" + "a".repeat(40) + " 2026-10-24 #1 subject"].join("\n"),
  );
  assert.equal(values.get("a"), "2");
  assert.equal(values.get("note"), "x = y = z");
  assert.equal(taken.length, 1);
});

test("a line without '=' is a parse error", () => {
  assert.throws(() => parseUpstreamBase("schema=1\nnot a pair\n"), /line 2: expected key=value/);
});

test("a missing required key is reported", () => {
  const errors = validate(RECORD.replace(/^sync_date=.*\n/m, ""));
  assert.ok(errors.some((error) => error.includes("missing required key: sync_date")), errors.join("\n"));
});

test("a non-40-hex commit is reported", () => {
  const errors = validate(RECORD.replace(/^fork_base_commit=.*$/m, "fork_base_commit=eabc816e"));
  assert.ok(errors.some((error) => error.includes("fork_base_commit must be a 40-hex commit")), errors.join("\n"));
});

test("a malformed sync_basis is reported", () => {
  const errors = validate(RECORD.replace(/^sync_basis=.*$/m, "sync_basis=main"));
  assert.ok(errors.some((error) => error.includes("sync_basis must be")), errors.join("\n"));
});

test("a local_line that disagrees with the packages is reported", () => {
  const errors = validate(RECORD.replace(/^local_line=.*$/m, "local_line=9.9.9"));
  assert.ok(errors.some((error) => error.includes("local_line=9.9.9 but package.json=0.1.4")), errors.join("\n"));
  assert.ok(errors.some((error) => error.includes("packages off the declared local line")), errors.join("\n"));
});

test("an integration_surface entry that no longer exists is reported", () => {
  const errors = validate(RECORD.replace(/^integration_surface=.*$/m, "integration_surface=packages/daemon/src/startup.ts,packages/daemon/src/gone.ts"));
  assert.ok(errors.some((error) => error.includes("integration_surface file does not exist: packages/daemon/src/gone.ts")), errors.join("\n"));
});

test("a malformed taken_commit line is reported", () => {
  const errors = validate(withLine("taken_commit=deadbeef 2026-10-24 #1 too short"));
  assert.ok(errors.some((error) => error.includes("taken_commit must be")), errors.join("\n"));
});

test("a well-formed taken_commit line is accepted", () => {
  const errors = validate(withLine(`taken_commit=${"b".repeat(40)} 2026-10-25 #1859 fix(daemon): a backport`));
  assert.deepEqual(errors, []);
});

test("a missing UPSTREAM-BASE file is reported by validateRepository", () => {
  const { errors, summary } = validateRepository(path.join(REPO, "docs", "releases"));
  assert.deepEqual(errors, ["UPSTREAM-BASE is missing at the repository root"]);
  assert.equal(summary, null);
});

test("the r19 fork policy is recorded and machine-checked", () => {
  const { values } = parseUpstreamBase(RECORD);
  assert.equal(values.get("fork_model"), "independent-local-line");
  assert.equal(values.get("upstream_role"), "read-only-reference");
  assert.equal(values.get("integration_model"), "manual-backport-of-selected-commits");
  assert.match(values.get("version_line_policy"), /local-semver-independent-of-upstream/);
  assert.match(values.get("sync_cadence"), /per-quarter/);

  const wrongModel = validate(RECORD.replace(/^fork_model=.*$/m, "fork_model=upstream-mirror"));
  assert.ok(wrongModel.some((error) => error.includes('fork_model must be "independent-local-line"')), wrongModel.join("\n"));

  const wrongRole = validate(RECORD.replace(/^upstream_role=.*$/m, "upstream_role=merge-target"));
  assert.ok(wrongRole.some((error) => error.includes('upstream_role must be "read-only-reference"')), wrongRole.join("\n"));

  const thinPolicy = validate(RECORD.replace(/^sync_cadence=.*$/m, "sync_cadence=often"));
  assert.ok(thinPolicy.some((error) => error.includes("sync_cadence must state the policy")), thinPolicy.join("\n"));
});
