import type { StructuredTranscript } from "./types.js";
/**
 * Parse a Codex JSONL string (the full file content as a single string)
 * into a StructuredTranscript. Pure function; no I/O.
 *
 * Malformed lines are skipped silently (matches Velocity prior art
 * `:100-102`); the lineCount counts every non-empty input line, so the
 * count of skipped lines is `lineCount - <kept-or-typed records>`.
 */
export declare function parseCodexJsonl(content: string): StructuredTranscript;
//# sourceMappingURL=codex-jsonl-parser.d.ts.map