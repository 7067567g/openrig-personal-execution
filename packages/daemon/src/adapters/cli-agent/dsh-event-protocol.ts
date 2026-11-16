// DSH `--json` event folding, kept side-effect free so the wire contract can be
// tested without spawning a real `dsh`.
//
// The runner feeds one stdout line at a time into `applyDshEventLine()` and only
// performs IO (sidecar writes, pane text, error markers). Failure classification
// is separate (`dshTurnOutcome`) because it depends on the child exit code and
// stderr, which arrive after the last event.
//
// Protocol: DSH 0.2.1-rc.2. The public vocabulary is `session` / `status` /
// `text` / `thinking` / `tool_call` / `tool_result` / `final` / `error`
// (dsh-headless README). OpenRig consumes the subset below; the rest is
// deliberately ignored rather than rejected, so a future DSH can add events
// without breaking the runner.

/** Bumped when the consumed subset changes shape (not when DSH adds events). */
export const DSH_EVENT_PROTOCOL_VERSION = 1;

/** Maximum bytes of an error message kept in the runner sidecar/pane. */
const MAX_ERROR_LENGTH = 1200;

export interface DshTurnState {
  /** Final-answer fragments, concatenated for `lastResultText`. */
  text: string[];
  error?: string;
  /** Runtime-native DSH session id; seeded from the resume token when present. */
  sessionId?: string;
  /** True once a `final` event was observed, even one with empty text. */
  finalSeen: boolean;
  sessionEvents: number;
  statusEvents: number;
  finalEvents: number;
  errorEvents: number;
}

export interface DshEventEffect {
  /** Set when the line carried a session id (verbatim DSH value). */
  sessionId?: string;
  /** True when a session id replaced a different, already-known id. */
  sessionConflict?: boolean;
  /** Final text that should be echoed to the pane. */
  text?: string;
  /** Terminal error recorded from this line. */
  error?: string;
}

export interface DshTurnOutcome {
  /** Failure derived from the process result; undefined means "no new error". */
  error?: string;
  /** Exit 0 without a `final` event. Current behavior: success with empty text. */
  missingFinal: boolean;
}

export function createDshTurnState(sessionId?: string): DshTurnState {
  return {
    text: [],
    sessionId,
    finalSeen: false,
    sessionEvents: 0,
    statusEvents: 0,
    finalEvents: 0,
    errorEvents: 0,
  };
}

export function cleanDshError(value: unknown): string {
  const json = typeof value === "string" ? value : JSON.stringify(value);
  const text = json ?? String(value);
  return text.length > MAX_ERROR_LENGTH ? `${text.slice(0, MAX_ERROR_LENGTH)}…` : text;
}

/** The session id DSH puts at the top level of an event (`sessionID` or `sessionId`). */
export function extractDshSessionId(event: Record<string, unknown>): string | undefined {
  const id = event["sessionID"] ?? event["sessionId"];
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function applySessionId(event: Record<string, unknown>, state: DshTurnState, effect: DshEventEffect): void {
  const id = extractDshSessionId(event);
  if (!id) return;
  effect.sessionConflict = state.sessionId !== undefined && state.sessionId !== id;
  state.sessionId = id;
  effect.sessionId = id;
}

function statusError(event: Record<string, unknown>): string | undefined {
  const reason = event["reason"];
  if (!reason || typeof reason !== "object" || (reason as Record<string, unknown>)["kind"] !== "error") {
    return undefined;
  }
  return cleanDshError((reason as Record<string, unknown>)["error"]);
}

/**
 * Fold one decoded DSH event into `state`. Unknown event types are ignored.
 *
 * Consumed shapes (see the module header):
 * - `{"type":"session","sessionId":"..."}` — resume identity, first line.
 * - `{"type":"status","phase":"turn_start"|"progress"|"turn_end",...}` — only
 *   `reason.kind === "error"` is terminal; phase names are not interpreted.
 * - `{"type":"final","text":"..."}` — the answer; empty text emits nothing.
 * - `{"type":"error","error":...}` — terminal error without a `final`.
 */
export function applyDshEvent(event: Record<string, unknown>, state: DshTurnState): DshEventEffect {
  const effect: DshEventEffect = {};
  applySessionId(event, state, effect);

  const type = event["type"];
  if (type === "session") {
    state.sessionEvents += 1;
    return effect;
  }
  if (type === "status") {
    state.statusEvents += 1;
    const error = statusError(event);
    if (error !== undefined) {
      state.error = error;
      effect.error = error;
    }
    return effect;
  }
  if (type === "final") {
    state.finalEvents += 1;
    state.finalSeen = true;
    const text = event["text"];
    if (typeof text === "string" && text.length > 0) {
      state.text.push(text);
      effect.text = text;
    }
    return effect;
  }
  if (type === "error") {
    state.errorEvents += 1;
    const error = cleanDshError(event["error"] ?? event);
    state.error = error;
    effect.error = error;
  }
  return effect;
}

/** Parse + fold one stdout line. Blank and malformed lines are ignored, not fatal. */
export function applyDshEventLine(line: string, state: DshTurnState): DshEventEffect | null {
  if (!line.trim()) return null;
  let event: Record<string, unknown>;
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    event = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return applyDshEvent(event, state);
}

/**
 * Classify the turn after the child closed. Preserves the pre-extraction
 * semantics: an event-recorded error wins; otherwise a non-zero exit uses the
 * stderr tail (or a synthetic message). Exit 0 with no `final` is reported as
 * `missingFinal` but is *not* turned into an error here — callers keep the
 * historical "success with empty text" behavior until a budget/contract round
 * decides otherwise.
 */
export function dshTurnOutcome(
  state: DshTurnState,
  code: number | null,
  stderr: string,
): DshTurnOutcome {
  if (state.error !== undefined) return { error: undefined, missingFinal: false };
  if (code !== 0) {
    const tail = stderr.trim();
    return {
      error: cleanDshError(tail || `runtime exited with code ${code ?? "unknown"}`),
      missingFinal: false,
    };
  }
  return { error: undefined, missingFinal: !state.finalSeen };
}
