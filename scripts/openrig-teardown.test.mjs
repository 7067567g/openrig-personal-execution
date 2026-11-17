// Regression coverage for scripts/openrig-teardown.py.
//
// A5 from 01b-recon: `--allow-incomplete` used to accept any string starting with
// "D-", so a PARTIAL archive could be torn down by inventing `D-999`. The guard now
// requires the decision to be recorded for that exact run in ARCHIVE-DECISIONS.md.
//
// The manifest and ledger are synthetic; no daemon is started and no real teardown
// command is run (the `--execute` tests only `touch` a marker in the temp dir).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  RUN_ID,
  cleanup,
  makeTempFixture,
  missingRuntime,
  runTeardown,
  writeCompleteManifest,
  writeDecisionLedger,
  writePartialManifest,
} from "./openrig-archive-test-helpers.mjs";

const skip = missingRuntime();

function parseReport(result) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`teardown did not emit JSON (rc=${result.code}):\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
}

test("A5: PARTIAL archive is denied without a recorded decision ledger entry", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const archiveRoot = path.join(root, "archive");
  writePartialManifest(archiveRoot);

  const result = runTeardown([
    "--run-id", RUN_ID,
    "--archive-root", archiveRoot,
    "--allow-incomplete",
    "--decision", "D-999",
    "--json",
  ]);
  assert.equal(result.code, 2, `invented decision must not unlock teardown:\n${result.stdout}\n${result.stderr}`);
  const report = parseReport(result);
  assert.equal(report.historicalOverride, undefined);
  assert.match(String(report.error || ""), /not recorded|ledger/i);
});

test("A5: a decision recorded for another run does not unlock this run", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const archiveRoot = path.join(root, "archive");
  writePartialManifest(archiveRoot);
  writeDecisionLedger(archiveRoot, [
    "| decision | run | status | disposition |",
    "| --- | --- | --- | --- |",
    "| D-T01 | some-other-run | PARTIAL | accepted for another run |",
  ]);

  const result = runTeardown([
    "--run-id", RUN_ID,
    "--archive-root", archiveRoot,
    "--allow-incomplete",
    "--decision", "D-T01",
    "--json",
  ]);
  assert.equal(result.code, 2);
  assert.match(String(parseReport(result).error || ""), /not recorded/i);
});

test("A5: a different decision ID recorded for this run does not unlock it", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const archiveRoot = path.join(root, "archive");
  writePartialManifest(archiveRoot);
  writeDecisionLedger(archiveRoot, [
    `| decision | run | status | disposition |`,
    `| D-T02 | ${RUN_ID} | PARTIAL | recorded for a different decision |`,
  ]);

  const result = runTeardown([
    "--run-id", RUN_ID,
    "--archive-root", archiveRoot,
    "--allow-incomplete",
    "--decision", "D-T01",
    "--json",
  ]);
  assert.equal(result.code, 2);
  assert.match(String(parseReport(result).error || ""), /not recorded/i);
});

test("A5: malformed decision IDs are rejected even when a ledger exists", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const archiveRoot = path.join(root, "archive");
  writePartialManifest(archiveRoot);
  writeDecisionLedger(archiveRoot, [`| D- | ${RUN_ID} | PARTIAL | malformed |`]);

  const result = runTeardown([
    "--run-id", RUN_ID,
    "--archive-root", archiveRoot,
    "--allow-incomplete",
    "--decision", "D-",
    "--json",
  ]);
  assert.equal(result.code, 2);
});

test("A5: a recorded decision permits preflight and names the ledger line", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const archiveRoot = path.join(root, "archive");
  writePartialManifest(archiveRoot);
  writeDecisionLedger(archiveRoot, [
    "| decision | run | status | disposition |",
    "| --- | --- | --- | --- |",
    `| D-T01 | ${RUN_ID} | PARTIAL | accepted historical home gap |`,
  ]);

  const result = runTeardown([
    "--run-id", RUN_ID,
    "--archive-root", archiveRoot,
    "--allow-incomplete",
    "--decision", "D-T01",
    "--json",
  ]);
  assert.equal(result.code, 0, `recorded decision should allow preflight:\n${result.stdout}\n${result.stderr}`);
  const report = parseReport(result);
  assert.equal(report.historicalOverride, true);
  assert.match(String(report.decisionRecord || ""), /ARCHIVE-DECISIONS\.md:3/);
});

test("A5: a denied override never executes the teardown command", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const archiveRoot = path.join(root, "archive");
  writePartialManifest(archiveRoot);
  const marker = path.join(root, "executed.marker");

  const result = runTeardown([
    "--run-id", RUN_ID,
    "--archive-root", archiveRoot,
    "--allow-incomplete",
    "--decision", "D-999",
    "--execute",
    "--teardown-cmd", `touch ${marker}`,
    "--json",
  ]);
  assert.equal(result.code, 2);
  assert.equal(existsSync(marker), false, "denied teardown must not execute the command");
});

test("A5: a recorded override executes only with --execute and --teardown-cmd", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const archiveRoot = path.join(root, "archive");
  writePartialManifest(archiveRoot);
  writeDecisionLedger(archiveRoot, [
    `| D-T01 | ${RUN_ID} | PARTIAL | accepted historical home gap |`,
  ]);
  const marker = path.join(root, "executed.marker");

  const dryRun = runTeardown([
    "--run-id", RUN_ID,
    "--archive-root", archiveRoot,
    "--allow-incomplete",
    "--decision", "D-T01",
    "--json",
  ]);
  assert.equal(dryRun.code, 0);
  assert.equal(parseReport(dryRun).dryRun, true);
  assert.equal(existsSync(marker), false, "preflight must not execute anything");

  const executed = runTeardown([
    "--run-id", RUN_ID,
    "--archive-root", archiveRoot,
    "--allow-incomplete",
    "--decision", "D-T01",
    "--execute",
    "--teardown-cmd", `touch ${marker}`,
    "--json",
  ]);
  assert.equal(executed.code, 0, `executed teardown failed:\n${executed.stdout}\n${executed.stderr}`);
  assert.equal(existsSync(marker), true, "allowed teardown must execute the command");
});

test("COMPLETE archives still need no decision and can execute", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const archiveRoot = path.join(root, "archive");
  writeCompleteManifest(archiveRoot);
  const marker = path.join(root, "complete.marker");

  const result = runTeardown([
    "--run-id", RUN_ID,
    "--archive-root", archiveRoot,
    "--execute",
    "--teardown-cmd", `touch ${marker}`,
    "--json",
  ]);
  assert.equal(result.code, 0, `COMPLETE archive must pass the gate:\n${result.stdout}\n${result.stderr}`);
  const report = parseReport(result);
  assert.equal(report.complete, true);
  assert.equal(report.historicalOverride, undefined);
  assert.equal(existsSync(marker), true);
});

test("missing manifest still returns rc=1 and never executes", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const archiveRoot = path.join(root, "archive");
  const marker = path.join(root, "missing.marker");

  const result = runTeardown([
    "--run-id", "does-not-exist",
    "--archive-root", archiveRoot,
    "--execute",
    "--teardown-cmd", `touch ${marker}`,
    "--json",
  ]);
  assert.equal(result.code, 1);
  assert.equal(parseReport(result).archiveStatus, "MISSING");
  assert.equal(existsSync(marker), false);
});

test("COMPLETE archive with an explicit n/a session snapshot passes", { skip }, (t) => {
  const root = makeTempFixture();
  t.after(() => cleanup(root));
  const archiveRoot = path.join(root, "archive");
  writeCompleteManifest(archiveRoot, { naSession: true });
  const marker = path.join(root, "na.marker");

  const result = runTeardown([
    "--run-id", RUN_ID,
    "--archive-root", archiveRoot,
    "--execute",
    "--teardown-cmd", `touch ${marker}`,
    "--json",
  ]);
  assert.equal(result.code, 0, `n/a required item must not block teardown:\n${result.stdout}\n${result.stderr}`);
  const report = parseReport(result);
  assert.equal(report.complete, true);
  assert.deepEqual(report.missingRequired, []);
  assert.equal(report.notApplicable.sessionSnapshots, true);
  assert.equal(existsSync(marker), true);
});
