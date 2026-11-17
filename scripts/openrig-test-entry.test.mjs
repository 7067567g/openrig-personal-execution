import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCRIPT = join(REPO_ROOT, "scripts", "openrig-test-entry.sh");
const HAS_VITEST = existsSync(join(REPO_ROOT, "node_modules", ".bin", "vitest"));

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "openrig-test-entry-"));
}

function writeCoreFiles(group) {
  for (const file of [
    "tests/test_openrig_run.py",
    "tests/test_openrig_manifest.py",
    "tests/test_openrig_gate.py",
    "tests/test_openrig_continuity.py",
  ]) {
    const path = join(group, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "# fixture\n", "utf8");
  }
}

function fakePython(root, { importPytest = true } = {}) {
  const path = join(root, "fake-python");
  writeFileSync(
    path,
    "#!/usr/bin/env bash\n" +
      `if [[ "$1" == "-c" && "$2" == "import pytest" ]]; then exit ${importPytest ? 0 : 1}; fi\n` +
      "exit 0\n",
    "utf8",
  );
  chmodSync(path, 0o755);
  return path;
}

function runScript(mode, env = {}) {
  const childEnv = { ...process.env };
  delete childEnv.OPENRIG_WORKFLOW_GROUP;
  delete childEnv.OPENRIG_WORKFLOW_GROUP_PYTHON;
  Object.assign(childEnv, env);
  return spawnSync("bash", [SCRIPT, mode], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: childEnv,
    timeout: 120_000,
  });
}

test("explicit empty workflow-group directory fails with rc2", (t) => {
  const root = tempRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const group = join(root, "empty-group");
  mkdirSync(group);
  const python = fakePython(root);
  const result = runScript("workflow", {
    OPENRIG_WORKFLOW_GROUP: group,
    OPENRIG_WORKFLOW_GROUP_PYTHON: python,
  });
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /missing test file/);
});

test("explicit workflow-group path that is not a directory fails with rc2", (t) => {
  const root = tempRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const notDir = join(root, "not-a-directory");
  writeFileSync(notDir, "not a directory\n", "utf8");
  const python = fakePython(root);
  const result = runScript("workflow", {
    OPENRIG_WORKFLOW_GROUP: notDir,
    OPENRIG_WORKFLOW_GROUP_PYTHON: python,
  });
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /not a directory/);
});

test(
  "explicit incomplete security lane fails with rc2 instead of skipping redteam",
  { skip: !HAS_VITEST ? "vitest is not installed; run npm ci first" : false },
  (t) => {
  const root = tempRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const group = join(root, "core-only");
  writeCoreFiles(group);
  const python = fakePython(root);
  const result = runScript("security", {
    OPENRIG_WORKFLOW_GROUP: group,
    OPENRIG_WORKFLOW_GROUP_PYTHON: python,
  });
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /missing test file/);
  assert.match(result.stderr, /redteam/);
  },
);

test("unset workflow-group remains an rc0 skip", () => {
  const result = runScript("workflow");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /SKIP workflow-group tests:/);
  assert.match(result.stdout, /not set/);
});

test("explicit workflow-group with a python that cannot import pytest fails with rc2", (t) => {
  const root = tempRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const group = join(root, "group");
  writeCoreFiles(group);
  const python = fakePython(root, { importPytest: false });
  const result = runScript("workflow", {
    OPENRIG_WORKFLOW_GROUP: group,
    OPENRIG_WORKFLOW_GROUP_PYTHON: python,
  });
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /OPENRIG_WORKFLOW_GROUP/);
  assert.match(result.stderr, /pytest/);
});
