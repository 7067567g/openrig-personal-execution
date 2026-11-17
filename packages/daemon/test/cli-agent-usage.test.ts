import { spawn, type ChildProcess } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  cliAgentUsageSnapshot,
  createCliAgentUsageState,
  observeCliAgentUsageEvent,
  parseCliAgentUsageSidecar,
  setCliAgentUsageSession,
} from "../src/adapters/cli-agent/cli-agent-usage.js";
import { cliAgentUsagePath } from "../src/adapters/cli-agent/cli-agent-runner-protocol.js";

const AT = "2026-11-15T14:00:00.000Z";
const LATER = "2026-11-15T14:05:00.000Z";

function opencodeStep(overrides: {
  id?: string;
  input?: number;
  output?: number;
  reasoning?: number;
  cacheRead?: number;
  cacheWrite?: number;
  cost?: number;
  total?: number;
} = {}): Record<string, unknown> {
  return {
    type: "step_finish",
    part: {
      id: overrides.id ?? "prt_step_1",
      tokens: {
        input: overrides.input ?? 10,
        output: overrides.output ?? 4,
        reasoning: overrides.reasoning ?? 1,
        cache: { read: overrides.cacheRead ?? 2, write: overrides.cacheWrite ?? 3 },
        ...(overrides.total === undefined ? {} : { total_tokens: overrides.total }),
      },
      ...(overrides.cost === undefined ? { cost: 0.0125 } : { cost: overrides.cost }),
    },
  };
}

describe("cli-agent usage fold — opencode", () => {
  it("folds one step_finish into totals, cost, lastStep and steps", () => {
    const state = createCliAgentUsageState("opencode", "exec-tdo-oc@rig");
    expect(observeCliAgentUsageEvent(state, opencodeStep(), AT)).toBe(true);

    const sidecar = cliAgentUsageSnapshot(state, LATER);
    expect(sidecar).toMatchObject({
      schemaVersion: 1,
      runtime: "opencode",
      sessionName: "exec-tdo-oc@rig",
      sampledAt: LATER,
      steps: 1,
      totals: { input: 10, output: 4, reasoning: 1, cacheRead: 2, cacheWrite: 3, total: null, costUsd: 0.0125 },
      lastStep: {
        at: AT,
        input: 10,
        output: 4,
        reasoning: 1,
        cacheRead: 2,
        cacheWrite: 3,
        total: null,
        costUsd: 0.0125,
      },
    });
  });

  it("accumulates two steps and ignores a replayed part.id", () => {
    const state = createCliAgentUsageState("opencode", "s");
    expect(observeCliAgentUsageEvent(state, opencodeStep({ id: "a" }), AT)).toBe(true);
    expect(observeCliAgentUsageEvent(state, opencodeStep({ id: "b", cost: 0.5 }), AT)).toBe(true);

    // The same event fed again must not advance anything.
    expect(observeCliAgentUsageEvent(state, opencodeStep({ id: "b", cost: 0.5 }), LATER)).toBe(false);

    const sidecar = cliAgentUsageSnapshot(state, LATER);
    expect(sidecar.steps).toBe(2);
    expect(sidecar.totals.input).toBe(20);
    expect(sidecar.totals.costUsd).toBeCloseTo(0.5125, 10);
    expect(sidecar.lastStep?.costUsd).toBe(0.5);
  });

  it("resets totals when the native session changes", () => {
    const state = createCliAgentUsageState("opencode", "s", "ses_old");
    observeCliAgentUsageEvent(state, opencodeStep({ id: "a", input: 100, cost: 1 }), AT);
    expect(state.steps).toBe(1);
    expect(state.totals.input).toBe(100);

    expect(setCliAgentUsageSession(state, "ses_new", LATER)).toBe(true);
    expect(state.steps).toBe(0);
    expect(state.totals).toEqual({
      input: null, output: null, reasoning: null,
      cacheRead: null, cacheWrite: null, total: null, costUsd: null,
    });
    expect(state.lastStep).toBeNull();
    expect(state.lastEventId).toBeUndefined();

    observeCliAgentUsageEvent(state, opencodeStep({ id: "b", input: 7, cost: 0.2 }), LATER);
    expect(state.steps).toBe(1);
    expect(state.totals.input).toBe(7);
    expect(state.totals.costUsd).toBe(0.2);
  });

  it("does not reset on the first session id assignment", () => {
    const state = createCliAgentUsageState("opencode", "s");
    observeCliAgentUsageEvent(state, opencodeStep({ id: "a" }), AT);
    expect(setCliAgentUsageSession(state, "ses_first", LATER)).toBe(false);
    expect(state.steps).toBe(1);
  });

  it("keeps costUsd null until a numeric cost appears", () => {
    const state = createCliAgentUsageState("opencode", "s");
    const withoutCost = { type: "step_finish", part: { id: "c", tokens: { input: 1, output: 1 } } };
    observeCliAgentUsageEvent(state, withoutCost, AT);
    expect(state.steps).toBe(1);
    expect(state.totals.costUsd).toBeNull();
    expect(state.lastStep?.costUsd).toBeNull();

    observeCliAgentUsageEvent(state, opencodeStep({ id: "d", cost: 0.25 }), AT);
    expect(state.totals.costUsd).toBe(0.25);
  });
});

describe("cli-agent usage fold — dsh", () => {
  it("folds status.step_end tokens with cost=null and reasoning=0", () => {
    const state = createCliAgentUsageState("dsh", "dev-stub");
    const advanced = observeCliAgentUsageEvent(state, {
      type: "status",
      phase: "step_end",
      turn: 1,
      step: 2,
      usage: { inputTokens: 12, outputTokens: 7, cacheReadTokens: 5, cacheWriteTokens: 1, totalTokens: 25 },
    }, AT);
    expect(advanced).toBe(true);

    const sidecar = cliAgentUsageSnapshot(state, LATER);
    expect(sidecar.runtime).toBe("dsh");
    expect(sidecar.steps).toBe(1);
    expect(sidecar.totals).toEqual({
      input: 12,
      output: 7,
      reasoning: null,
      cacheRead: 5,
      cacheWrite: 1,
      total: 25,
      costUsd: null,
    });
    expect(sidecar.lastStep).toEqual({
      at: AT,
      input: 12,
      output: 7,
      reasoning: null,
      cacheRead: 5,
      cacheWrite: 1,
      total: 25,
      costUsd: null,
    });
  });

  it("accepts snake_case usage field names", () => {
    const state = createCliAgentUsageState("dsh", "s");
    observeCliAgentUsageEvent(state, {
      type: "status",
      phase: "step_end",
      turn: 1,
      step: 1,
      usage: { input_tokens: 3, output_tokens: 2 },
    }, AT);
    expect(state.totals.input).toBe(3);
    expect(state.totals.output).toBe(2);
  });

  it("dedupes a replayed turn/step pair", () => {
    const state = createCliAgentUsageState("dsh", "s");
    const event = { type: "status", phase: "step_end", turn: 1, step: 1, usage: { inputTokens: 5, outputTokens: 5 } };
    expect(observeCliAgentUsageEvent(state, event, AT)).toBe(true);
    expect(observeCliAgentUsageEvent(state, event, LATER)).toBe(false);
    expect(state.steps).toBe(1);
    expect(state.totals.input).toBe(5);
  });

  it("skips an empty envelope usage and reads the nested populated one", () => {
    const state = createCliAgentUsageState("dsh", "s");
    expect(observeCliAgentUsageEvent(state, {
      type: "status",
      phase: "step_end",
      turn: 1,
      step: 1,
      usage: {},
      data: { usage: { inputTokens: 9, outputTokens: 4 } },
    }, AT)).toBe(true);
    expect(state.totals.input).toBe(9);
    expect(state.totals.output).toBe(4);
  });
});

describe("cli-agent usage fold — honest counters and replay window", () => {
  it("accepts a total_tokens/totalTokens-only step without inventing per-field zeros", () => {
    const dsh = createCliAgentUsageState("dsh", "s");
    expect(observeCliAgentUsageEvent(dsh, {
      type: "status", phase: "step_end", turn: 4, step: 2,
      usage: { total_tokens: 42 },
    }, AT)).toBe(true);
    expect(dsh.steps).toBe(1);
    expect(dsh.totals).toMatchObject({
      input: null, output: null, reasoning: null,
      cacheRead: null, cacheWrite: null, total: 42,
    });

    const opencode = createCliAgentUsageState("opencode", "s");
    expect(observeCliAgentUsageEvent(opencode, {
      type: "step_finish", part: { id: "total-only", tokens: { totalTokens: 9 }, cost: 0.01 },
    }, AT)).toBe(true);
    expect(opencode.steps).toBe(1);
    expect(opencode.totals).toMatchObject({
      input: null, output: null, reasoning: null,
      cacheRead: null, cacheWrite: null, total: 9,
    });
  });

  it("keeps missing counters unknown across a later partial step", () => {
    const state = createCliAgentUsageState("dsh", "s");
    observeCliAgentUsageEvent(state, {
      type: "status", phase: "step_end", turn: 1, step: 1,
      usage: { inputTokens: 5 },
    }, AT);
    expect(state.totals).toMatchObject({
      input: 5, output: null, reasoning: null,
      cacheRead: null, cacheWrite: null, total: null,
    });

    observeCliAgentUsageEvent(state, {
      type: "status", phase: "step_end", turn: 2, step: 1,
      usage: { inputTokens: 3, outputTokens: 7 },
    }, LATER);
    // Input stayed reportable; output was never reported on step 1, so its
    // cumulative value remains unknown rather than retroactively becoming 7.
    expect(state.totals.input).toBe(8);
    expect(state.totals.output).toBeNull();
    expect(state.totals.cacheRead).toBeNull();
  });

  it("does not emit a step for an empty usage envelope or a cost-only step", () => {
    const opencode = createCliAgentUsageState("opencode", "s");
    expect(observeCliAgentUsageEvent(opencode, {
      type: "step_finish", part: { id: "empty", tokens: {}, cost: 0.5 },
    }, AT)).toBe(false);
    expect(opencode.steps).toBe(0);
    expect(opencode.lastStep).toBeNull();

    const dsh = createCliAgentUsageState("dsh", "s");
    expect(observeCliAgentUsageEvent(dsh, {
      type: "status", phase: "step_end", turn: 1, step: 1, usage: {},
    }, AT)).toBe(false);
    expect(dsh.steps).toBe(0);
    expect(dsh.lastStep).toBeNull();
  });

  it("dedupes replaying several earlier ids, not just the most recent one", () => {
    const state = createCliAgentUsageState("opencode", "s");
    for (const id of ["a", "b", "c"]) {
      expect(observeCliAgentUsageEvent(state, opencodeStep({ id, input: 2, cost: 0.01 }), AT)).toBe(true);
    }
    const before = cliAgentUsageSnapshot(state, LATER);
    expect(observeCliAgentUsageEvent(state, opencodeStep({ id: "a", input: 2, cost: 0.01 }), LATER)).toBe(false);
    expect(observeCliAgentUsageEvent(state, opencodeStep({ id: "b", input: 2, cost: 0.01 }), LATER)).toBe(false);
    expect(state.steps).toBe(3);
    expect(state.totals.input).toBe(6);
    expect(state.totals.costUsd).toBeCloseTo(0.03, 10);
    expect(cliAgentUsageSnapshot(state, LATER).totals).toEqual(before.totals);
  });

  it("keeps the replay window bounded", () => {
    const state = createCliAgentUsageState("opencode", "s");
    for (let i = 0; i < 70; i += 1) {
      observeCliAgentUsageEvent(state, opencodeStep({ id: `id-${i}`, input: 1 }), AT);
    }
    expect(state.recentEventIds).toHaveLength(64);
    expect(state.recentEventIds[0]).toBe("id-6");
    expect(state.recentEventIds.at(-1)).toBe("id-69");
    // A replay older than the retained window cannot be proven duplicate; a
    // replay inside it still can.
    expect(observeCliAgentUsageEvent(state, opencodeStep({ id: "id-69", input: 1 }), LATER)).toBe(false);
    expect(observeCliAgentUsageEvent(state, opencodeStep({ id: "id-5", input: 1 }), LATER)).toBe(true);
  });
});

describe("cli-agent usage fold — occupant generations", () => {
  it("resumes only the same occupant generation and rejects a same-name successor", () => {
    const predecessor = createCliAgentUsageState("opencode", "same-name@r", "ses-old", null, "gen-a");
    observeCliAgentUsageEvent(predecessor, opencodeStep({ id: "old-step", input: 100, cost: 1 }), AT);
    const prior = parseCliAgentUsageSidecar(JSON.stringify(cliAgentUsageSnapshot(predecessor, LATER)))!;
    expect(prior.occupantGeneration).toBe("gen-a");

    const continuation = createCliAgentUsageState("opencode", "same-name@r", "ses-old", prior, "gen-a");
    expect(continuation.steps).toBe(1);
    expect(continuation.totals.input).toBe(100);
    expect(observeCliAgentUsageEvent(continuation, opencodeStep({ id: "old-step", input: 100, cost: 1 }), LATER)).toBe(false);

    const successor = createCliAgentUsageState("opencode", "same-name@r", undefined, prior, "gen-b");
    expect(successor.occupantGeneration).toBe("gen-b");
    expect(successor.sessionId).toBeUndefined();
    expect(successor.steps).toBe(0);
    expect(successor.totals).toEqual({
      input: null, output: null, reasoning: null,
      cacheRead: null, cacheWrite: null, total: null, costUsd: null,
    });
    expect(successor.recentEventIds).toEqual([]);
    // The predecessor's id is not in the successor's window, so it is a fresh
    // observation for this generation rather than being silently dropped.
    expect(observeCliAgentUsageEvent(successor, opencodeStep({ id: "old-step", input: 7, cost: 0.1 }), LATER)).toBe(true);
    expect(successor.totals.input).toBe(7);
  });

  it("starts empty when the live generation is known but a legacy sidecar has none", () => {
    const legacy = createCliAgentUsageState("opencode", "s", "ses-1", null, undefined);
    observeCliAgentUsageEvent(legacy, opencodeStep({ id: "x", input: 50, cost: 0.5 }), AT);
    const prior = parseCliAgentUsageSidecar(JSON.stringify(cliAgentUsageSnapshot(legacy, LATER)))!;
    expect(prior.occupantGeneration).toBeUndefined();

    const current = createCliAgentUsageState("opencode", "s", undefined, prior, "gen-current");
    expect(current.steps).toBe(0);
    expect(current.totals.input).toBeNull();
    expect(current.occupantGeneration).toBe("gen-current");
  });
});

describe("cli-agent usage fold — non-usage events", () => {
  it("returns false and leaves state untouched", () => {
    const state = createCliAgentUsageState("opencode", "s");
    observeCliAgentUsageEvent(state, opencodeStep({ id: "a" }), AT);
    const before = cliAgentUsageSnapshot(state, AT);

    expect(observeCliAgentUsageEvent(state, { type: "text", part: { text: "hi" } }, LATER)).toBe(false);
    expect(observeCliAgentUsageEvent(state, { type: "status", phase: "turn_start" }, LATER)).toBe(false);
    expect(observeCliAgentUsageEvent(state, { type: "step_end" }, LATER)).toBe(false);

    const after = cliAgentUsageSnapshot(state, LATER);
    expect(after.steps).toBe(before.steps);
    expect(after.totals).toEqual(before.totals);
    expect(after.lastStep).toEqual(before.lastStep);
  });
});

describe("parseCliAgentUsageSidecar", () => {
  it("round-trips a snapshot", () => {
    const state = createCliAgentUsageState("opencode", "s", "ses_1");
    observeCliAgentUsageEvent(state, opencodeStep(), AT);
    const parsed = parseCliAgentUsageSidecar(JSON.stringify(cliAgentUsageSnapshot(state, LATER)));
    expect(parsed).toMatchObject({ runtime: "opencode", sessionName: "s", sessionId: "ses_1", steps: 1 });
    expect(parsed?.lastEventId).toBe("prt_step_1");
  });

  it("resumes the dedup key so a replayed tail is ignored after restart", () => {
    const first = createCliAgentUsageState("opencode", "s");
    observeCliAgentUsageEvent(first, opencodeStep({ id: "same" }), AT);
    const prior = parseCliAgentUsageSidecar(JSON.stringify(cliAgentUsageSnapshot(first, LATER)))!;

    const resumed = createCliAgentUsageState("opencode", "s", undefined, prior);
    expect(observeCliAgentUsageEvent(resumed, opencodeStep({ id: "same" }), LATER)).toBe(false);
    expect(resumed.steps).toBe(1);
  });

  it("resumes totals from a prior sidecar", () => {
    const first = createCliAgentUsageState("opencode", "s");
    observeCliAgentUsageEvent(first, opencodeStep({ id: "a" }), AT);
    const prior = parseCliAgentUsageSidecar(JSON.stringify(cliAgentUsageSnapshot(first, LATER)))!;

    const resumed = createCliAgentUsageState("opencode", "s", undefined, prior);
    expect(resumed.steps).toBe(1);
    observeCliAgentUsageEvent(resumed, opencodeStep({ id: "b" }), LATER);
    expect(resumed.steps).toBe(2);
    expect(resumed.totals.input).toBe(20);
  });

  it("returns null for bad JSON, wrong schema and missing fields", () => {
    expect(parseCliAgentUsageSidecar("{not json")).toBeNull();
    expect(parseCliAgentUsageSidecar("[]")).toBeNull();
    expect(parseCliAgentUsageSidecar(JSON.stringify({ schemaVersion: 2 }))).toBeNull();

    const valid = JSON.parse(
      JSON.stringify(cliAgentUsageSnapshot(createCliAgentUsageState("dsh", "s"), AT)),
    ) as Record<string, unknown>;

    const missingTotals = { ...valid };
    delete missingTotals["totals"];
    expect(parseCliAgentUsageSidecar(JSON.stringify(missingTotals))).toBeNull();

    const badSteps = { ...valid, steps: -1 };
    expect(parseCliAgentUsageSidecar(JSON.stringify(badSteps))).toBeNull();

    const badCost = { ...valid, totals: { ...(valid["totals"] as object), costUsd: "free" } };
    expect(parseCliAgentUsageSidecar(JSON.stringify(badCost))).toBeNull();
  });
});

describe("cli-agent runner usage sidecar", () => {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
  const RUNNER = path.join(REPO_ROOT, "packages/daemon/src/adapters/cli-agent/cli-agent-runner.ts");

  const running: ChildProcess[] = [];
  afterEach(() => {
    for (const child of running.splice(0)) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
  });

  function tempDir(): string {
    return mkdtempSync(path.join(tmpdir(), "openrig-usage-"));
  }

  function stubBin(dir: string, script: string): string {
    const bin = path.join(dir, "stub-runtime");
    writeFileSync(bin, script, "utf8");
    chmodSync(bin, 0o755);
    return bin;
  }

  function startRunner(opts: { dir: string; runtime: "opencode" | "dsh"; script: string; env?: Record<string, string | undefined> }) {
    const stateRoot = path.join(opts.dir, "state");
    const args = [
      "--import", "tsx", RUNNER,
      "--runtime", opts.runtime,
      "--session-name", "dev-stub",
      "--state-root", stateRoot,
      "--launch-id", "launch-usage",
      "--cwd", opts.dir,
      "--bin", stubBin(opts.dir, opts.script),
    ];
    const child = spawn(process.execPath, args, {
      cwd: REPO_ROOT,
      env: { ...process.env, ...opts.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    running.push(child);
    let stderr = "";
    child.stderr!.setEncoding("utf8");
    child.stderr!.on("data", (chunk: string) => { stderr += chunk; });
    child.stdin!.write("do the task\n");
    const usagePath = cliAgentUsagePath(stateRoot, "dev-stub");
    return {
      child,
      stderr: () => stderr,
      usagePath,
      usage: (): Record<string, unknown> | null => {
        if (!existsSync(usagePath)) return null;
        try { return JSON.parse(readFileSync(usagePath, "utf8")) as Record<string, unknown>; } catch { return null; }
      },
    };
  }

  async function waitFor<T>(fn: () => T | undefined | null, label: string, timeoutMs = 15_000): Promise<T> {
    const start = Date.now();
    for (;;) {
      const value = fn();
      if (value !== undefined && value !== null) return value;
      if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${label}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  async function stop(child: ChildProcess): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>((resolve) => {
      child.once("close", () => resolve());
      child.kill("SIGTERM");
      setTimeout(() => resolve(), 2000).unref?.();
    });
  }

  it("persists opencode step_finish totals to usage.json", async () => {
    const dir = tempDir();
    try {
      const script = `#!/usr/bin/env node
const emit = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
emit({ type: "session", sessionID: "ses_stub" });
emit({ type: "step_finish", part: { id: "prt_1", tokens: { input: 11, output: 5, reasoning: 2, cache: { read: 4, write: 6 } }, cost: 0.125 } });
emit({ type: "text", part: { text: "done" } });
process.exit(0);
`;
      const handle = startRunner({ dir, runtime: "opencode", script });
      const usage = await waitFor(() => {
        const value = handle.usage();
        return value && value["steps"] === 1 ? value : undefined;
      }, "opencode usage.json");

      expect(usage).toMatchObject({
        schemaVersion: 1,
        runtime: "opencode",
        sessionName: "dev-stub",
        sessionId: "ses_stub",
        steps: 1,
        totals: { input: 11, output: 5, reasoning: 2, cacheRead: 4, cacheWrite: 6, costUsd: 0.125 },
      });
      const totals = usage["totals"] as Record<string, unknown>;
      expect(typeof usage["sampledAt"]).toBe("string");
      expect(totals["costUsd"]).toBe(0.125);
      expect(usage["lastStep"]).toMatchObject({ input: 11, costUsd: 0.125 });
      await stop(handle.child);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("persists dsh status.step_end tokens with cost=null", async () => {
    const dir = tempDir();
    try {
      const script = `#!/usr/bin/env node
const emit = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
emit({ type: "session", sessionId: "session-stub" });
emit({ type: "status", phase: "step_end", turn: 1, step: 1, usage: { inputTokens: 9, outputTokens: 3, cacheReadTokens: 1, cacheWriteTokens: 0 } });
emit({ type: "final", text: "ok" });
process.exit(0);
`;
      const handle = startRunner({ dir, runtime: "dsh", script });
      const usage = await waitFor(() => {
        const value = handle.usage();
        return value && value["steps"] === 1 ? value : undefined;
      }, "dsh usage.json");

      expect(usage).toMatchObject({
        runtime: "dsh",
        sessionName: "dev-stub",
        sessionId: "session-stub",
        steps: 1,
        totals: { input: 9, output: 3, reasoning: null, cacheRead: 1, cacheWrite: 0, total: null, costUsd: null },
      });
      await stop(handle.child);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("resumes accumulated totals after a runner restart", async () => {
    const dir = tempDir();
    try {
      const stepScript = (id: string, input: number): string => `#!/usr/bin/env node
const emit = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
emit({ type: "step_finish", part: { id: "${id}", tokens: { input: ${input}, output: 1 }, cost: 0.01 } });
process.exit(0);
`;

      const first = startRunner({ dir, runtime: "opencode", script: stepScript("prt_first", 10) });
      await waitFor(() => {
        const value = first.usage();
        return value && value["steps"] === 1 ? value : undefined;
      }, "first usage.json");
      await stop(first.child);

      const second = startRunner({ dir, runtime: "opencode", script: stepScript("prt_second", 5) });
      const usage = await waitFor(() => {
        const value = second.usage();
        return value && value["steps"] === 2 ? value : undefined;
      }, "resumed usage.json");

      expect(usage["steps"]).toBe(2);
      expect((usage["totals"] as Record<string, unknown>)["input"]).toBe(15);
      expect((usage["totals"] as Record<string, unknown>)["costUsd"]).toBeCloseTo(0.02, 10);
      await stop(second.child);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("does not resume a same-name successor's predecessor sidecar", async () => {
    const dir = tempDir();
    try {
      const stepScript = (id: string, input: number): string => `#!/usr/bin/env node
const emit = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
emit({ type: "step_finish", part: { id: "${id}", tokens: { input: ${input}, output: 1 }, cost: 0.01 } });
process.exit(0);
`;
      const first = startRunner({
        dir, runtime: "opencode", script: stepScript("shared-id", 100),
        env: { OPENRIG_OCCUPANT_GENERATION: "gen-a" },
      });
      const firstUsage = await waitFor(() => {
        const value = first.usage();
        return value && value["steps"] === 1 ? value : undefined;
      }, "predecessor usage.json");
      expect(firstUsage["occupantGeneration"]).toBe("gen-a");
      expect((firstUsage["totals"] as Record<string, unknown>)["input"]).toBe(100);
      await stop(first.child);

      const successor = startRunner({
        dir, runtime: "opencode", script: stepScript("shared-id", 7),
        env: { OPENRIG_OCCUPANT_GENERATION: "gen-b" },
      });
      const successorUsage = await waitFor(() => {
        const value = successor.usage();
        return value && value["occupantGeneration"] === "gen-b" ? value : undefined;
      }, "successor usage.json");
      expect(successorUsage["steps"]).toBe(1);
      expect((successorUsage["totals"] as Record<string, unknown>)["input"]).toBe(7);
      await stop(successor.child);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
