// Regression coverage for scripts/openrig-archive.py.
//
// Each test names the 01b-recon gap it pins:
//   A1  self-containment guard was inverted (archive root inside the run was allowed)
//   A2  an empty OPENRIG_HOME could still satisfy the strict COMPLETE gate
//   A3  a failed SQLite online backup did not clear homeSnapshot
//   A4  session snapshots lived outside MANIFEST.files / SHA256SUMS
//
// The fixture is synthetic: no daemon, no real OPENRIG_HOME, no network.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  archiveArgs,
  cleanup,
  makeStrictFixture,
  makeTempFixture,
  missingRuntime,
  readManifest,
  runArchive,
  verifySha256Sums,
} from "./openrig-archive-test-helpers.mjs";

const skip = missingRuntime();

test("strict COMPLETE archive still succeeds and hashes every run/home file", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const fixture = makeStrictFixture(root);

  const result = runArchive(archiveArgs(fixture));
  assert.equal(result.code, 0, `archive failed:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /status=COMPLETE/);

  const manifest = readManifest(fixture);
  assert.equal(manifest.archiveStatus, "COMPLETE");
  assert.deepEqual(manifest.required, {
    runSnapshot: true,
    sessionSnapshots: true,
    transcriptCapture: true,
    openrigState: true,
    homeSnapshot: true,
  });
  const paths = manifest.files.map((f) => f.path);
  assert.ok(paths.includes("run/OPENRIG-STATE.json"), `run file missing from MANIFEST.files: ${paths}`);
  assert.ok(paths.includes("home/openrig.sqlite"), `home db missing from MANIFEST.files: ${paths}`);

  const sums = verifySha256Sums(path.join(fixture.archiveRoot, "machines", "test-machine", "runs", fixture.runId));
  assert.ok(sums.length > 0);
});

test("A1: archive root inside the run dir is refused and writes nothing", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const fixture = makeStrictFixture(root);
  const nestedRoot = path.join(fixture.runDir, "var", "archive");

  const result = runArchive(archiveArgs(fixture, nestedRoot));
  assert.equal(result.code, 2, `nested archive root must be refused:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /inside itself/);
  assert.equal(existsSync(nestedRoot), false, "refused archive must not create the nested archive root");
  assert.equal(existsSync(path.join(fixture.runDir, "var")), false, "refused archive must not write under the run dir");
});

test("A1: archive root equal to the run dir is refused", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const fixture = makeStrictFixture(root);

  const result = runArchive(archiveArgs(fixture, fixture.runDir));
  assert.equal(result.code, 2);
  assert.match(result.stderr, /inside itself/);
});

test("A1: archive root that is an ancestor of the run dir is allowed (guard not re-inverted)", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const fixture = makeStrictFixture(root);

  // `root` is the run dir's parent, i.e. archive_root in run_dir.parents. The old
  // inverted guard rejected exactly this legitimate layout.
  const result = runArchive(archiveArgs(fixture, root));
  assert.equal(result.code, 0, `ancestor archive root must be allowed:\n${result.stdout}\n${result.stderr}`);
  assert.equal(existsSync(path.join(root, "machines", "test-machine", "runs", fixture.runId, "MANIFEST.json")), true);
});

test("A2: an empty OPENRIG_HOME cannot produce COMPLETE", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const fixture = makeStrictFixture(root, { homeMode: "empty" });

  const result = runArchive(archiveArgs(fixture));
  assert.equal(result.code, 3, `strict gate must fail for an empty home:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /status=PARTIAL/);
  const manifest = readManifest(fixture);
  assert.equal(manifest.archiveStatus, "PARTIAL");
  assert.equal(manifest.required.homeSnapshot, false);
  assert.ok(manifest.missing.includes("homeSnapshot"), `missing should name homeSnapshot: ${manifest.missing}`);
  assert.match(String(manifest.openrigHome.error || ""), /empty/i);
});

test("A3: a failed SQLite online backup clears homeSnapshot", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const fixture = makeStrictFixture(root, { homeMode: "bad-sqlite" });

  const result = runArchive(archiveArgs(fixture));
  assert.equal(result.code, 3, `strict gate must fail for an unusable sqlite snapshot:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /status=PARTIAL/);
  const manifest = readManifest(fixture);
  assert.equal(manifest.archiveStatus, "PARTIAL");
  assert.equal(manifest.required.homeSnapshot, false);
  const sqlite = manifest.openrigHome.sqlite || [];
  assert.equal(sqlite.length, 1);
  assert.equal(sqlite[0].ok, false);
  assert.match(String(manifest.openrigHome.error || ""), /sqlite/i);
});

test("A4: session snapshots are listed in MANIFEST.files and SHA256SUMS", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const fixture = makeStrictFixture(root);
  const result = runArchive(archiveArgs(fixture));
  assert.equal(result.code, 0, `archive failed:\n${result.stdout}\n${result.stderr}`);

  const runArchiveDir = path.join(fixture.archiveRoot, "machines", "test-machine", "runs", fixture.runId);
  const manifest = readManifest(fixture);
  const sessionPrefix = `../../sessions/${fixture.sessionId}/`;
  const sessionRows = manifest.files.filter((f) => f.path.startsWith(sessionPrefix));
  const sessionPaths = sessionRows.map((f) => f.path);
  assert.ok(
    sessionPaths.includes(`${sessionPrefix}events.jsonl`),
    `session event file missing from MANIFEST.files: ${sessionPaths.join(", ")}`,
  );
  assert.ok(
    sessionPaths.includes(`${sessionPrefix}SESSION-SOURCE.json`),
    `SESSION-SOURCE.json missing from MANIFEST.files: ${sessionPaths.join(", ")}`,
  );
  for (const row of sessionRows) {
    assert.match(row.sha256, /^[0-9a-f]{64}$/);
    assert.equal(typeof row.bytes, "number");
    assert.equal(row.scope, "session");
  }

  const sumsText = readFileSync(path.join(runArchiveDir, "SHA256SUMS"), "utf8");
  assert.match(sumsText, new RegExp(`\\.\\./\\.\\./sessions/${fixture.sessionId}/events\\.jsonl`));
  assert.match(sumsText, new RegExp(`\\.\\./\\.\\./sessions/${fixture.sessionId}/SESSION-SOURCE\\.json`));

  // End-to-end: every SHA256SUMS line resolves and matches, session paths included.
  const entries = verifySha256Sums(runArchiveDir);
  assert.ok(entries.some((e) => e.relPath.includes(`/sessions/${fixture.sessionId}/events.jsonl`)));
});
