import { describe, expect, it } from "vitest";
import {
  buildCliAgentInvocation,
  buildCliAgentRunnerCommand,
  cliAgentSeatPaths,
  parseCliAgentRunnerState,
  sanitizeCliAgentSessionName,
} from "../src/adapters/cli-agent/cli-agent-runner-protocol.js";

describe("cli-agent runner protocol", () => {
  it("builds a stable seat state path even for @ and spaces", () => {
    expect(sanitizeCliAgentSessionName("exec-tdo a@rig")).toBe("exec-tdo_a@rig");
    expect(cliAgentSeatPaths("/state", "exec-tdo-a@rig")).toEqual({
      seatRoot: "/state/exec-tdo-a@rig",
      runnerStatePath: "/state/exec-tdo-a@rig/runner-state.json",
    });
  });

  it("builds an opencode launch command with explicit binary/model/resume", () => {
    const command = buildCliAgentRunnerCommand({
      runtime: "opencode",
      runnerEntryPath: "/pkg/cli-agent-runner.js",
      sessionName: "exec-tdo-a@rig",
      stateRoot: "/state/opencode",
      cwd: "/work",
      launchId: "launch-1",
      bin: "/node/bin/opencode",
      model: "opencode-go/deepseek-v4.1-flash",
      agent: "sisyphus",
      resumeToken: "ses_123",
    });
    expect(command).toContain("--runtime opencode");
    expect(command).toContain("--bin '/node/bin/opencode'");
    expect(command).toContain("--model 'opencode-go/deepseek-v4.1-flash'");
    expect(command).toContain("--agent 'sisyphus'");
    expect(command).toContain("--resume-token 'ses_123'");
  });

  it("builds opencode run invocations with session continuation", () => {
    expect(buildCliAgentInvocation({
      runtime: "opencode",
      bin: "opencode",
      text: "do work",
      sessionId: "ses_123",
      model: "opencode-go/deepseek-v4.1-flash",
      agent: "sisyphus",
    })).toEqual({
      command: "opencode",
      args: ["run", "--format", "json", "--model", "opencode-go/deepseek-v4.1-flash", "--agent", "sisyphus", "--session", "ses_123", "do work"],
    });
  });

  it("builds DSH headless invocations with session continuation", () => {
    expect(buildCliAgentInvocation({
      runtime: "dsh",
      bin: "dsh",
      text: "do work",
      sessionId: "session-123",
      profile: "headless",
    })).toEqual({
      command: "dsh",
      args: ["--profile", "headless", "--json", "--session-id", "session-123", "do work"],
    });
  });

  it("rejects malformed state rather than treating it as ready", () => {
    expect(parseCliAgentRunnerState("not json")).toBeNull();
    expect(parseCliAgentRunnerState(JSON.stringify({ ready: true }))).toBeNull();
    expect(parseCliAgentRunnerState(JSON.stringify({ ready: true, updatedAt: "now" }))).toMatchObject({ ready: true });
  });
});
