import { spawnSync } from "node:child_process";
import { accessSync, constants, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// The shim is shipped at packages/daemon/assets/dsh/dsh-web-shim.py. These tests
// exercise the real Python process with a fake `dsh_ctl` module on HOME: no
// DSH Web instance, no port 3080, no credential.
const SHIM_PATH = fileURLToPath(new URL("../assets/dsh/dsh-web-shim.py", import.meta.url));
const FAKE_DSH_CTL = `
import os

MODE = os.environ.get("FAKE_DSH_MODE", "success")
_state = {"prompted": False}


def find_session_by_id(sid):
    return None


def create_session(cwd=None, agent_preset=None):
    return {"sessionId": "session-fake"}


def wait_until_idle(sid, timeout=0):
    return True, {}


def prompt(sid, task, timeout=0):
    _state["prompted"] = True
    return True


def projections(sid):
    if MODE == "timeout":
        return {"asOfSeq": 0}
    return {"asOfSeq": 2 if _state["prompted"] else 0}


def page_events(sid, as_of):
    return [
        {"seq": 1, "type": "assistant/message", "data": {"text": "fake answer"}},
        {"seq": 2, "type": "turn/end"},
    ]


def _assistant_texts(event):
    return [str((event.get("data") or {}).get("text") or "")]
`;

const hasPython = spawnSync("python3", ["--version"], { encoding: "utf8" }).status === 0;
const homes: string[] = [];

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

function makeHome(mode: "success" | "timeout" | "missing"): string {
  const home = mkdtempSync(nodePath.join(tmpdir(), "openrig-dsh-shim-"));
  homes.push(home);
  if (mode !== "missing") {
    const bridge = nodePath.join(home, ".dsh", "clawbot-bridge", "bridge-fork");
    mkdirSync(bridge, { recursive: true });
    writeFileSync(nodePath.join(bridge, "dsh_ctl.py"), `${FAKE_DSH_CTL}\n`, "utf8");
  }
  return home;
}

function runShim(opts: { mode: "success" | "timeout" | "missing"; args?: string[]; timeout?: string }) {
  const home = makeHome(opts.mode);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    DSH_HOME: nodePath.join(home, ".dsh"),
    PYTHONNOUSERSITE: "1",
    PYTHONPATH: "",
    FAKE_DSH_MODE: opts.mode,
  };
  if (opts.timeout) env["OPENRIG_DSH_REPLY_TIMEOUT"] = opts.timeout;
  const result = spawnSync(
    "python3",
    [SHIM_PATH, ...(opts.args ?? ["--profile", "headless", "--json", "do work"])],
    { cwd: home, env, encoding: "utf8", timeout: 20_000 },
  );
  const lines = (result.stdout ?? "").split("\n").filter((line) => line.trim().length > 0);
  return {
    status: result.status,
    stderr: result.stderr ?? "",
    events: lines.map((line) => JSON.parse(line) as Record<string, unknown>),
    rawStdout: result.stdout ?? "",
  };
}

describe.skipIf(!hasPython)("DSH shared-web shim contract", () => {
  it("is shipped in the daemon assets tree with an executable bit", () => {
    expect(() => accessSync(SHIM_PATH, constants.X_OK)).not.toThrow();
  });

  it("emits session -> status -> final for a successful turn", () => {
    const run = runShim({ mode: "success" });
    expect(run.status).toBe(0);
    expect(run.events.map((event) => event["type"])).toEqual([
      "session",
      "status",
      "status",
      "status",
      "final",
    ]);
    expect(run.events[0]).toMatchObject({ type: "session", sessionId: "session-fake" });
    expect(run.events[1]).toMatchObject({ type: "status", phase: "turn_start", turn: 1 });
    expect(run.events[2]).toMatchObject({ type: "status", phase: "progress" });
    expect(run.events[3]).toMatchObject({ type: "status", phase: "turn_end", turn: 1 });
    expect(run.events[4]).toEqual({ type: "final", text: "fake answer" });
    expect(run.stderr).toBe("");
  });

  it("times out with a terminal error status, an empty final, and exit 1", () => {
    const run = runShim({ mode: "timeout", timeout: "0.05" });
    expect(run.status).toBe(1);
    const errorStatus = run.events.find(
      (event) => event["type"] === "status" && (event["reason"] as Record<string, unknown> | undefined)?.["kind"] === "error",
    );
    expect(errorStatus).toBeDefined();
    expect(errorStatus?.["reason"]).toMatchObject({
      kind: "error",
      error: { code: "OPENRIG_DSH_WEB_SHIM" },
    });
    const reason = errorStatus?.["reason"] as Record<string, unknown>;
    expect(reason["error"]).toMatchObject({ message: expect.stringContaining("超时") });
    expect(run.events.at(-1)).toEqual({ type: "final", text: "" });
    expect(run.stderr).toContain("超时");
  });

  it("fails non-zero with no NDJSON and no final when dsh_ctl is unavailable", () => {
    const run = runShim({ mode: "missing" });
    expect(run.status).not.toBe(0);
    expect(run.rawStdout.trim()).toBe("");
    expect(run.events).toEqual([]);
    expect(run.stderr).toContain("dsh_ctl");
  });

  it("rejects an empty task before emitting any event", () => {
    const run = runShim({ mode: "success", args: ["--profile", "headless", "--json"] });
    expect(run.status).toBe(2);
    expect(run.events).toEqual([]);
    expect(run.stderr).toContain("empty task");
  });
});
