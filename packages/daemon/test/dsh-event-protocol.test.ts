import { describe, expect, it } from "vitest";
import {
  applyDshEvent,
  applyDshEventLine,
  cleanDshError,
  createDshTurnState,
  dshTurnOutcome,
  DSH_EVENT_PROTOCOL_VERSION,
  extractDshSessionId,
} from "../src/adapters/cli-agent/dsh-event-protocol.js";

function fold(lines: string[], sessionId?: string) {
  const state = createDshTurnState(sessionId);
  const effects = lines.map((line) => applyDshEventLine(line, state));
  return { state, effects };
}

describe("DSH event protocol", () => {
  it("pins the consumed protocol version and top-level session-id spelling", () => {
    expect(DSH_EVENT_PROTOCOL_VERSION).toBe(1);
    expect(extractDshSessionId({ sessionID: "session-a" })).toBe("session-a");
    expect(extractDshSessionId({ sessionId: "session-b" })).toBe("session-b");
    expect(extractDshSessionId({ sessionId: "" })).toBeUndefined();
    expect(extractDshSessionId({})).toBeUndefined();
  });

  it("folds the session -> status -> final sequence", () => {
    const { state, effects } = fold([
      JSON.stringify({ type: "session", sessionId: "session-1" }),
      JSON.stringify({ type: "status", phase: "turn_start", turn: 1 }),
      JSON.stringify({ type: "status", phase: "progress", text: "工具调用", event: "tool/call" }),
      JSON.stringify({ type: "final", text: "done" }),
    ]);

    expect(effects[0]).toMatchObject({ sessionId: "session-1" });
    expect(effects[1]).toEqual({});
    expect(effects[2]).toEqual({});
    expect(effects[3]).toEqual({ text: "done" });
    expect(state.sessionId).toBe("session-1");
    expect(state.sessionEvents).toBe(1);
    expect(state.statusEvents).toBe(2);
    expect(state.finalEvents).toBe(1);
    expect(state.text).toEqual(["done"]);
    expect(state.finalSeen).toBe(true);
    expect(state.error).toBeUndefined();
    expect(dshTurnOutcome(state, 0, "")).toEqual({ error: undefined, missingFinal: false });
  });

  it("accumulates final fragments in order, including multiple finals", () => {
    const { state } = fold([
      JSON.stringify({ type: "final", text: "part-1 " }),
      JSON.stringify({ type: "final", text: "part-2" }),
    ]);
    expect(state.text).toEqual(["part-1 ", "part-2"]);
    expect(state.text.join("")).toBe("part-1 part-2");
    expect(state.finalSeen).toBe(true);
  });

  it("treats status.reason.kind=error as terminal but ignores other phases", () => {
    const { state } = fold([
      JSON.stringify({ type: "status", phase: "progress", reason: { kind: "ok" } }),
      JSON.stringify({
        type: "status",
        phase: "turn_end",
        reason: { kind: "error", error: { message: "web session busy", code: "busy" } },
      }),
    ]);
    expect(state.statusEvents).toBe(2);
    expect(state.error).toContain("web session busy");

    const outcome = dshTurnOutcome(state, 1, "also stderr");
    expect(outcome.error).toBeUndefined(); // event-recorded error wins over stderr
    expect(outcome.missingFinal).toBe(false);
  });

  it("records an error event without a final as the turn error", () => {
    const { state } = fold([
      JSON.stringify({ type: "session", sessionId: "session-err" }),
      JSON.stringify({ type: "error", error: { message: "provider auth failed" } }),
    ]);
    expect(state.finalSeen).toBe(false);
    expect(state.errorEvents).toBe(1);
    expect(state.error).toContain("provider auth failed");
    expect(dshTurnOutcome(state, 0, "")).toEqual({ error: undefined, missingFinal: false });
  });

  it("maps a non-zero exit to the stderr tail, or a synthetic message when stderr is empty", () => {
    const withStderr = createDshTurnState();
    withStderr.finalSeen = true;
    expect(dshTurnOutcome(withStderr, 3, "  boom: bad things  \n")).toEqual({
      error: "boom: bad things",
      missingFinal: false,
    });

    const emptyStderr = createDshTurnState();
    expect(dshTurnOutcome(emptyStderr, 2, "   \n")).toEqual({
      error: "runtime exited with code 2",
      missingFinal: false,
    });

    const signalled = createDshTurnState();
    expect(dshTurnOutcome(signalled, null, "")).toEqual({
      error: "runtime exited with code unknown",
      missingFinal: false,
    });
  });

  it("pins exit 0 without final: reported as missingFinal, NOT converted into an error", () => {
    const { state } = fold([
      JSON.stringify({ type: "session", sessionId: "session-quiet" }),
      JSON.stringify({ type: "status", phase: "turn_end", turn: 1 }),
    ]);
    expect(state.finalSeen).toBe(false);
    expect(state.error).toBeUndefined();
    expect(dshTurnOutcome(state, 0, "")).toEqual({ error: undefined, missingFinal: true });
  });

  it("keeps the last session id and flags a conflicting duplicate", () => {
    const state = createDshTurnState("session-old");
    const first = applyDshEvent({ type: "session", sessionId: "session-old" }, state);
    expect(first.sessionId).toBe("session-old");
    expect(first.sessionConflict).toBe(false);

    const second = applyDshEvent({ type: "session", sessionId: "session-new" }, state);
    expect(second.sessionId).toBe("session-new");
    expect(second.sessionConflict).toBe(true);
    expect(state.sessionId).toBe("session-new");
  });

  it("ignores blank, malformed, non-object and unknown events without throwing", () => {
    const state = createDshTurnState();
    expect(applyDshEventLine("", state)).toBeNull();
    expect(applyDshEventLine("   ", state)).toBeNull();
    expect(applyDshEventLine("not json", state)).toBeNull();
    expect(applyDshEventLine("[1,2,3]", state)).toBeNull();
    expect(applyDshEventLine("null", state)).toBeNull();
    expect(applyDshEventLine(JSON.stringify({ type: "text", text: "ignored" }), state)).toEqual({});
    expect(state.sessionEvents).toBe(0);
    expect(state.statusEvents).toBe(0);
    expect(state.finalEvents).toBe(0);
    expect(state.error).toBeUndefined();
  });

  it("bounds error text at 1200 characters", () => {
    const long = "x".repeat(5000);
    const cleaned = cleanDshError(long);
    expect(cleaned).toHaveLength(1201);
    expect(cleaned.endsWith("…")).toBe(true);
    expect(cleanDshError(undefined)).toBe("undefined");
  });
});
