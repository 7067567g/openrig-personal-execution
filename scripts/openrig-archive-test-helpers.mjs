// Shared fixture helpers for the Python run-archive / teardown guard tests.
//
// These tests deliberately exercise the real scripts as subprocesses: the bugs they
// pin (self-nesting, weak home evidence, unhashed sessions, decision-prefix bypass)
// are all observable at the CLI boundary, and an in-process import would hide the
// rsync / sqlite / argv behaviour the guard actually depends on.
//
// No test touches the repo's real `var/openrig-archive` tree, spawns a daemon, or
// needs the network. Everything is built under a fresh mkdtemp directory.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const archiveScript = path.join(repoRoot, "scripts", "openrig-archive.py");
export const teardownScript = path.join(repoRoot, "scripts", "openrig-teardown.py");
export const pythonBin = process.env.PYTHON || "python3";

function probe(cmd, args) {
  try {
    execFileSync(cmd, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function missingRuntime() {
  if (!probe(pythonBin, ["--version"])) return `python3 is required to test the Python guard scripts (${pythonBin})`;
  if (!probe("rsync", ["--version"])) return "rsync is required by scripts/openrig-archive.py";
  return false;
}

export function runPython(script, args, options = {}) {
  const result = spawnSync(pythonBin, [script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", ...(options.env || {}) },
    timeout: options.timeout ?? 120_000,
  });
  return {
    code: result.status,
    signal: result.signal,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

export function runArchive(args) {
  return runPython(archiveScript, args);
}

export function runTeardown(args) {
  return runPython(teardownScript, args);
}

export function makeTempFixture(prefix = "openrig-guard-") {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  return root;
}

export function writeFile(filePath, contents) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

export function makeValidSqlite(dbPath) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const script = [
    "import sqlite3, sys",
    "conn = sqlite3.connect(sys.argv[1])",
    "conn.execute('create table if not exists probes (id integer primary key, note text)')",
    "conn.execute(\"insert into probes (note) values ('archive-test')\")",
    "conn.commit()",
    "conn.close()",
  ].join("; ");
  execFileSync(pythonBin, ["-c", script, dbPath], { stdio: "ignore" });
}

export const RUN_ID = "openrig-guard-fixture";

/**
 * Build a strict-COMPLETE-shaped fixture:
 *   run/OPENRIG-STATE.json, run/transcripts/transcript-control.jsonl
 *   home/openrig.sqlite (valid), home/daemon.json, home/transcripts/transcript-seat.jsonl
 *   sessions/workspace-key/<session-id>/events.jsonl
 */
export function makeStrictFixture(root, { homeMode = "good", withSession = true } = {}) {
  const runDir = path.join(root, RUN_ID);
  const homeDir = path.join(root, "home");
  const sessionsRoot = path.join(root, "sessions");
  const sessionId = "sess-guard-fixture";
  const archiveRoot = path.join(root, "archive");

  writeFile(path.join(runDir, "OPENRIG-STATE.json"), '{"status":"ready"}\n');
  writeFile(path.join(runDir, "transcripts", "transcript-control.jsonl"), '{"seq":1}\n{"seq":2}\n');

  if (homeMode !== "empty") {
    writeFile(path.join(homeDir, "daemon.json"), '{"pid":4242}\n');
    if (homeMode === "good") {
      makeValidSqlite(path.join(homeDir, "openrig.sqlite"));
      writeFile(path.join(homeDir, "transcripts", "transcript-seat.jsonl"), '{"seq":1}\n');
    } else if (homeMode === "bad-sqlite") {
      writeFile(path.join(homeDir, "openrig.sqlite"), "this is not a sqlite database\n");
    }
  } else {
    mkdirSync(homeDir, { recursive: true });
  }

  if (withSession) {
    writeFile(path.join(sessionsRoot, "workspace-key", sessionId, "events.jsonl"), '{"event":"session"}\n');
  }

  return { root, runDir, homeDir, sessionsRoot, sessionId, archiveRoot, runId: RUN_ID };
}

export function archiveArgs(fixture, archiveRoot = fixture.archiveRoot, extra = []) {
  return [
    "--run-dir", fixture.runDir,
    "--openrig-home", fixture.homeDir,
    "--session-id", fixture.sessionId,
    "--session-root", fixture.sessionsRoot,
    "--archive-root", archiveRoot,
    "--machine", "test-machine",
    ...extra,
  ];
}

export function manifestPath(fixture, archiveRoot = fixture.archiveRoot) {
  return path.join(archiveRoot, "machines", "test-machine", "runs", fixture.runId, "MANIFEST.json");
}

export function readManifest(fixture, archiveRoot = fixture.archiveRoot) {
  return JSON.parse(readFileSync(manifestPath(fixture, archiveRoot), "utf8"));
}

export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

/**
 * Parse a SHA256SUMS file into [{ hash, relPath }] and resolve every entry against
 * the run archive. `sha256sum -c` is not portable to macOS, so verification is done
 * in Node instead: every listed path must exist and hash to the recorded digest.
 */
export function verifySha256Sums(runArchiveDir) {
  const sumsPath = path.join(runArchiveDir, "SHA256SUMS");
  if (!existsSync(sumsPath)) throw new Error(`SHA256SUMS missing at ${sumsPath}`);
  const entries = readFileSync(sumsPath, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
      if (!match) throw new Error(`unparseable SHA256SUMS line: ${line}`);
      return { hash: match[1], relPath: match[2] };
    });
  for (const entry of entries) {
    const resolved = path.resolve(runArchiveDir, entry.relPath);
    if (!existsSync(resolved)) throw new Error(`SHA256SUMS references a missing file: ${entry.relPath}`);
    const actual = sha256File(resolved);
    if (actual !== entry.hash) throw new Error(`SHA256SUMS digest mismatch for ${entry.relPath}`);
  }
  return entries;
}

export function writeDecisionLedger(archiveRoot, lines) {
  writeFile(path.join(archiveRoot, "ARCHIVE-DECISIONS.md"), lines.join("\n") + "\n");
}

export function writePartialManifest(archiveRoot, { runId = RUN_ID, missing = ["homeSnapshot"] } = {}) {
  const required = {
    runSnapshot: true,
    sessionSnapshots: true,
    transcriptCapture: true,
    openrigState: true,
    homeSnapshot: true,
    ...Object.fromEntries(missing.map((key) => [key, false])),
  };
  const dir = path.join(archiveRoot, "machines", "test-machine", "runs", runId);
  writeFile(path.join(dir, "RECORD.md"), "# fixture\n");
  writeFile(
    path.join(dir, "MANIFEST.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        archiveStatus: "PARTIAL",
        runId,
        required,
        missing,
        files: [{ path: "RECORD.md", bytes: 10, sha256: "0".repeat(64), scope: "run" }],
      },
      null,
      2,
    ) + "\n",
  );
  writeFile(
    path.join(dir, "SHA256SUMS"),
    `${sha256File(path.join(dir, "RECORD.md"))}  RECORD.md\n`,
  );
  return dir;
}

export function writeCompleteManifest(archiveRoot, { runId = RUN_ID } = {}) {
  const required = {
    runSnapshot: true,
    sessionSnapshots: true,
    transcriptCapture: true,
    openrigState: true,
    homeSnapshot: true,
  };
  const dir = path.join(archiveRoot, "machines", "test-machine", "runs", runId);
  writeFile(path.join(dir, "RECORD.md"), "# complete fixture\n");
  writeFile(
    path.join(dir, "MANIFEST.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        archiveStatus: "COMPLETE",
        runId,
        required,
        missing: [],
        files: [{ path: "RECORD.md", bytes: 19, sha256: sha256File(path.join(dir, "RECORD.md")), scope: "run" }],
      },
      null,
      2,
    ) + "\n",
  );
  writeFile(
    path.join(dir, "SHA256SUMS"),
    `${sha256File(path.join(dir, "RECORD.md"))}  RECORD.md\n`,
  );
  return dir;
}

export function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}
