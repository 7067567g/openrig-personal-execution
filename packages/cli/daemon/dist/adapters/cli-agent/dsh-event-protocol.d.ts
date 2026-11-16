/** Bumped when the consumed subset changes shape (not when DSH adds events). */
export declare const DSH_EVENT_PROTOCOL_VERSION = 1;
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
export declare function createDshTurnState(sessionId?: string): DshTurnState;
export declare function cleanDshError(value: unknown): string;
/** The session id DSH puts at the top level of an event (`sessionID` or `sessionId`). */
export declare function extractDshSessionId(event: Record<string, unknown>): string | undefined;
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
export declare function applyDshEvent(event: Record<string, unknown>, state: DshTurnState): DshEventEffect;
/** Parse + fold one stdout line. Blank and malformed lines are ignored, not fatal. */
export declare function applyDshEventLine(line: string, state: DshTurnState): DshEventEffect | null;
/**
 * Classify the turn after the child closed. Preserves the pre-extraction
 * semantics: an event-recorded error wins; otherwise a non-zero exit uses the
 * stderr tail (or a synthetic message). Exit 0 with no `final` is reported as
 * `missingFinal` but is *not* turned into an error here — callers keep the
 * historical "success with empty text" behavior until a budget/contract round
 * decides otherwise.
 */
export declare function dshTurnOutcome(state: DshTurnState, code: number | null, stderr: string): DshTurnOutcome;
//# sourceMappingURL=dsh-event-protocol.d.ts.map