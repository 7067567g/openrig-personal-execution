import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CliAgentRuntimeAdapter } from "../src/adapters/cli-agent/cli-agent-runtime-adapter.js";
import { cliAgentSeatPaths } from "../src/adapters/cli-agent/cli-agent-runner-protocol.js";
import type { NodeBinding } from "../src/domain/runtime-adapter.js";

function makeBinding(cwd: string): NodeBinding {
  return {
    tmuxSession: "exec-tdo-a@rig",
    cwd,
    nodeId: "node-1",
    model: "opencode-go/deepseek-v4.1-flash",
    launchGeneration: "gen-1",
  } as unknown as NodeBinding;
}

function makeAdapter(root: string, runtime: "opencode" | "dsh", overrides: Record<string, unknown> = {}) {
  const stateRoot = nodePath.join(root, "state", runtime);
  const tmux = {
    hasSession: vi.fn(async () => true),
    getPaneCommand: vi.fn(async () => "node"),
    sendShellCommand: vi.fn(async () => ({ ok: true as const })),
    sendText: vi.fn(async () => ({ ok: true as const })),
    sendKeys: vi.fn(async () => ({ ok: true as const })),
  };
  const fsOps = {
    readFile: (p: string) => readFileSync(p, "utf8"),
    writeFile: (p: string, content: string) => writeFileSync(p, content, "utf8"),
    exists: (p: string) => { try { readFileSync(p); return true; } catch { return false; } },
    mkdirp: (p: string) => mkdirSync(p, { recursive: true }),
    listFiles: () => [],
  };
  const adapter = new CliAgentRuntimeAdapter({
    runtime,
    tmux: tmux as never,
    fsOps,
    stateRoot,
    runnerEntryPath: "/runner/cli-agent-runner.js",
    bin: runtime,
    model: "opencode-go/deepseek-v4.1-flash",
    agent: "sisyphus",
    profile: "headless",
    newLaunchId: () => "launch-test",
    sleep: async () => {},
    ...overrides,
  });
  return { adapter, tmux, stateRoot };
}

describe("CliAgentRuntimeAdapter", () => {
  const roots: string[] = [];
  const root = () => { const r = mkdtempSync(nodePath.join(tmpdir(), "cli-agent-adapter-")); roots.push(r); return r; };
  afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

  it.each(["opencode", "dsh"] as const)("launches a %s runner and reaches ready", async (runtime) => {
    const cwd = root();
    const { adapter, tmux, stateRoot } = makeAdapter(cwd, runtime);
    tmux.sendShellCommand.mockImplementationOnce(async () => {
      const seat = cliAgentSeatPaths(stateRoot, "exec-tdo-a@rig");
      writeFileSync(seat.runnerStatePath, JSON.stringify({
        ready: true,
        launchId: "launch-test",
        updatedAt: new Date().toISOString(),
      }), "utf8");
      return { ok: true as const };
    });
    const result = await adapter.launchHarness(makeBinding(cwd), { name: "exec-tdo-a" });
    expect(result.ok).toBe(true);
    expect(tmux.sendShellCommand).toHaveBeenCalledOnce();
    expect(String(tmux.sendShellCommand.mock.calls[0]?.[1])).toContain(`--runtime ${runtime}`);
    await expect(adapter.checkReady(makeBinding(cwd))).resolves.toMatchObject({ ready: true });
  });

  it("refuses fork source explicitly", async () => {
    const cwd = root();
    const { adapter } = makeAdapter(cwd, "opencode");
    await expect(adapter.launchHarness(makeBinding(cwd), {
      name: "exec-tdo-a",
      forkSource: { kind: "native_id", value: "x" },
    })).resolves.toMatchObject({ ok: false });
  });

  it("does not report ready when the sidecar is missing or exited", async () => {
    const cwd = root();
    const { adapter, stateRoot } = makeAdapter(cwd, "dsh");
    await expect(adapter.checkReady(makeBinding(cwd))).resolves.toMatchObject({ ready: false });
    const seat = cliAgentSeatPaths(stateRoot, "exec-tdo-a@rig");
    mkdirSync(seat.seatRoot, { recursive: true });
    writeFileSync(seat.runnerStatePath, JSON.stringify({ ready: true, exited: { code: 1, at: "now" }, updatedAt: "now" }), "utf8");
    await expect(adapter.checkReady(makeBinding(cwd))).resolves.toMatchObject({ ready: false });
  });

  it("projects guidance into AGENTS.md without touching source files", async () => {
    const cwd = root();
    const guidance = nodePath.join(cwd, "role.md");
    writeFileSync(guidance, "Role guidance\n", "utf8");
    const { adapter } = makeAdapter(cwd, "opencode");
    const plan = { entries: [{ classification: "new", effectiveId: "role", category: "guidance", mergeStrategy: "managed_block", absolutePath: guidance }] };
    const result = await adapter.project(plan as never, makeBinding(cwd));
    expect(result.projected).toEqual(["role"]);
    expect(readFileSync(nodePath.join(cwd, "AGENTS.md"), "utf8")).toContain("Role guidance");
  });

  it("reports ready from the runner sidecar even when the staged wrapper is still sh", async () => {
    const cwd = root();
    const { adapter, tmux, stateRoot } = makeAdapter(cwd, "opencode");
    tmux.getPaneCommand.mockResolvedValue("sh");
    const seat = cliAgentSeatPaths(stateRoot, "exec-tdo-a@rig");
    mkdirSync(seat.seatRoot, { recursive: true });
    writeFileSync(seat.runnerStatePath, JSON.stringify({ ready: true, launchId: "launch-test", updatedAt: "now" }), "utf8");
    await expect(adapter.checkReady(makeBinding(cwd))).resolves.toMatchObject({ ready: true });
    expect(tmux.sendText).not.toHaveBeenCalled();
  });

  it("merges send_text startup prose into AGENTS.md instead of writing to runner stdin", async () => {
    const cwd = root();
    const file = nodePath.join(cwd, "role.md");
    writeFileSync(file, "Startup prose\n", "utf8");
    const { adapter, tmux } = makeAdapter(cwd, "dsh");
    const result = await adapter.deliverStartup([{
      path: "role.md",
      absolutePath: file,
      deliveryHint: "send_text",
      required: true,
    } as never], makeBinding(cwd));
    expect(result.delivered).toBe(1);
    expect(tmux.sendText).not.toHaveBeenCalled();
    expect(readFileSync(nodePath.join(cwd, "AGENTS.md"), "utf8")).toContain("Startup prose");
  });


  it.each(["opencode", "dsh"] as const)("auto-resumes a prior sidecar for the same node but not a new rig", async (runtime) => {
    const cwd = root();
    const { adapter, tmux, stateRoot } = makeAdapter(cwd, runtime);
    const seat = cliAgentSeatPaths(stateRoot, "exec-tdo-a@rig");
    mkdirSync(seat.seatRoot, { recursive: true });
    writeFileSync(seat.runnerStatePath, JSON.stringify({
      ready: true,
      launchId: "old-launch",
      nodeId: "node-1",
      sessionId: runtime === "opencode" ? "ses_old" : "session-old",
      updatedAt: "now",
    }), "utf8");
    tmux.sendShellCommand.mockImplementationOnce(async () => {
      writeFileSync(seat.runnerStatePath, JSON.stringify({
        ready: true,
        launchId: "launch-test",
        nodeId: "node-1",
        sessionId: runtime === "opencode" ? "ses_old" : "session-old",
        updatedAt: new Date().toISOString(),
      }), "utf8");
      return { ok: true as const };
    });
    const result = await adapter.launchHarness(makeBinding(cwd), { name: "exec-tdo-a" });
    expect(result).toMatchObject({ ok: true, resumeToken: runtime === "opencode" ? "ses_old" : "session-old" });
    expect(String(tmux.sendShellCommand.mock.calls[0]?.[1])).toContain("--resume-token");
  });


  it("projects skills to the native .agents/skills discovery path", async () => {
    const cwd = root();
    const source = nodePath.join(cwd, "skill-source");
    mkdirSync(source, { recursive: true });
    const sourceFile = nodePath.join(source, "SKILL.md");
    writeFileSync(sourceFile, "---\nname: demo\ndescription: demo\n---\n", "utf8");
    const { adapter } = makeAdapter(cwd, "dsh");
    const plan = { entries: [{ classification: "new", effectiveId: "demo-skill", category: "skill", mergeStrategy: "copy", absolutePath: sourceFile }] };
    await expect(adapter.project(plan as never, makeBinding(cwd))).resolves.toMatchObject({ projected: ["demo-skill"] });
    expect(readFileSync(nodePath.join(cwd, ".agents", "skills", "demo-skill", "SKILL.md"), "utf8")).toContain("name: demo");
  });

});
