import { spawn, type ChildProcess } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// Runs the REAL pane-hosted runner (`cli-agent-runner.ts` via tsx) against a
// stub runtime executable. This is the only test that proves the runner's
// termination + sidecar reporting path, not just the pure budget fold.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
const RUNNER = path.join(REPO_ROOT, "packages/daemon/src/adapters/cli-agent/cli-agent-runner.ts");

const STUB = `#!/usr/bin/env node
const fs = require("node:fs");
const mode = process.env.STUB_MODE || "ok";
const state = process.env.STUB_STATE || "";
const emit = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
emit({ type: "session", sessionId: "session-stub" });
if (mode === "tools") {
  emit({ type: "step_end", usage: { total_tokens: 5 } });
  emit({ type: "tool_call", tool: "bash" });
  emit({ type: "tool_call", tool: "edit" });
  emit({ type: "tool_call", tool: "read" });
  emit({ type: "final", text: "three tools" });
  process.exit(0);
} else if (mode === "slow") {
  setTimeout(() => { emit({ type: "final", text: "late" }); process.exit(0); }, 5000);
} else if (mode === "fail_once") {
  let n = 0;
  try { n = Number(fs.readFileSync(state, "utf8")); } catch {}
  fs.writeFileSync(state, String(n + 1));
  if (n === 0) { process.stderr.write("transient failure\\n"); process.exit(1); }
  emit({ type: "final", text: "recovered" });
  process.exit(0);
} else {
  emit({ type: "final", text: "ok" });
  process.exit(0);
}
`;

interface RunnerHandle {
  child: ChildProcess;
  stdout: () => string;
  sidecar: () => Record<string, unknown> | null;
}

const running: ChildProcess[] = [];

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "openrig-budget-"));
  return dir;
}

function stubBin(dir: string): string {
  const bin = path.join(dir, "stub-dsh");
  writeFileSync(bin, STUB, "utf8");
  chmodSync(bin, 0o755);
  return bin;
}

function startRunner(opts: {
  dir: string;
  args?: string[];
  env?: Record<string, string>;
}): RunnerHandle {
  const stateRoot = path.join(opts.dir, "state");
  const sessionName = "dev-stub";
  const args = [
    "--import", "tsx", RUNNER,
    "--runtime", "dsh",
    "--session-name", sessionName,
    "--state-root", stateRoot,
    "--launch-id", "launch-1",
    "--cwd", opts.dir,
    "--bin", stubBin(opts.dir),
    ...(opts.args ?? []),
  ];
  const child = spawn(process.execPath, args, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...opts.env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  running.push(child);
  child.stdin!.write("do the task\n");
  let stdout = "";
  let stderr = "";
  child.stdout!.setEncoding("utf8");
  child.stderr!.setEncoding("utf8");
  child.stdout!.on("data", (chunk: string) => { stdout += chunk; });
  child.stderr!.on("data", (chunk: string) => { stderr += chunk; });
  const sidecarPath = path.join(stateRoot, "dev-stub", "runner-state.json");
  return {
    child,
    stdout: () => `${stdout}${stderr ? `\n[stderr]\n${stderr}` : ""}`,
    sidecar: () => {
      try { return JSON.parse(readFileSync(sidecarPath, "utf8")) as Record<string, unknown>; } catch { return null; }
    },
  };
}

async function waitFor<T>(fn: () => T | undefined | null, label: string, timeoutMs = 10_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = fn();
    if (value !== undefined && value !== null) return value;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timed out waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function stop(handle: RunnerHandle): Promise<void> {
  return new Promise((resolve) => {
    if (handle.child.exitCode !== null || handle.child.signalCode !== null) return resolve();
    handle.child.once("close", () => resolve());
    handle.child.kill("SIGTERM");
    setTimeout(() => resolve(), 2000).unref?.();
  });
}

afterEach(async () => {
  for (const child of running.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
});

describe("cli-agent runner task budgets", () => {
  it("passes no budget args by default: tool calls are not counted and no budget sidecar is written", async () => {
    const dir = tempDir();
    try {
      const handle = startRunner({ dir, env: { STUB_MODE: "tools" } });
      await waitFor(() => handle.sidecar()?.lastResultText === "three tools" ? true : undefined, "first turn");
      const sidecar = handle.sidecar()!;
      expect(sidecar["budget"]).toBeUndefined();
      expect(handle.stdout()).not.toContain("BUDGET_EXHAUSTED");
      await stop(handle);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it("terminates on the tool-call limit, reports the dimension, and does not retry", async () => {
    const dir = tempDir();
    try {
      const handle = startRunner({
        dir,
        env: { STUB_MODE: "tools" },
        args: [
          "--budget-max-wall-time-ms", "0",
          "--budget-max-steps", "0",
          "--budget-max-tool-calls", "2",
          "--budget-max-tokens", "0",
          "--budget-max-retries", "3",
        ],
      });
      const budget = await waitFor(
        () => handle.sidecar()?.["budget"] as Record<string, unknown> | undefined,
        "budget sidecar",
      );
      expect(budget["exhausted"]).toMatchObject({ dimension: "tool_calls", limit: 2, observed: 3 });
      expect(budget["retries_used"]).toBe(0);
      expect(budget["coverage"]).toMatchObject({ tool_calls: "reported", tokens: "reported" });
      expect(String(handle.sidecar()?.["lastError"])).toContain("tool_calls");
      expect(handle.stdout()).toContain("BUDGET_EXHAUSTED");
      await stop(handle);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it("terminates on the wall-clock limit", async () => {
    const dir = tempDir();
    try {
      const started = Date.now();
      const handle = startRunner({
        dir,
        env: { STUB_MODE: "slow" },
        args: [
          "--budget-max-wall-time-ms", "400",
          "--budget-max-steps", "10",
          "--budget-max-tool-calls", "10",
          "--budget-max-tokens", "1000",
          "--budget-max-retries", "0",
        ],
      });
      const budget = await waitFor(
        () => {
          const value = handle.sidecar()?.["budget"] as Record<string, unknown> | undefined;
          return value?.["exhausted"] ? value : undefined;
        },
        "wall-time breach",
        12_000,
      );
      expect(budget["exhausted"]).toMatchObject({ dimension: "wall_time", limit: 400 });
      expect(Date.now() - started).toBeLessThan(4500);
      expect(handle.stdout()).toContain("BUDGET_EXHAUSTED");
      expect(handle.stdout()).toContain("wall_time limit=400");
      await stop(handle);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it("retries a non-budget failure up to max_retries, with a visible marker and no silent retry", async () => {
    const dir = tempDir();
    try {
      const stateFile = path.join(dir, "attempts.txt");
      const handle = startRunner({
        dir,
        env: { STUB_MODE: "fail_once", STUB_STATE: stateFile },
        args: [
          "--budget-max-wall-time-ms", "10000",
          "--budget-max-steps", "10",
          "--budget-max-tool-calls", "10",
          "--budget-max-tokens", "1000",
          "--budget-max-retries", "1",
        ],
      });
      const budget = await waitFor(
        () => handle.sidecar()?.["budget"] as Record<string, unknown> | undefined,
        "retry outcome",
      );
      expect(budget["retries_used"]).toBe(1);
      expect(budget["exhausted"]).toBeUndefined();
      expect(handle.sidecar()?.["lastResultText"]).toBe("recovered");
      expect(handle.stdout()).toContain("RETRY 1/1");
      expect(existsSync(stateFile)).toBe(true);
      expect(readFileSync(stateFile, "utf8")).toBe("2");
      await stop(handle);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);
});
