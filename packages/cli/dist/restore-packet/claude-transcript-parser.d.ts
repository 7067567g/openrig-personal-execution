import type { StructuredTranscript } from "./types.js";
/**
 * Parse a Claude transcript JSONL string into a StructuredTranscript.
 * Pure function; no I/O.
 *
 * Output is the SAME shape as the Codex parser per the M2b dispatch's
 * "emit the same structured representation as the Codex parser"
 * requirement. Downstream modules (packet-writer, redaction-counter)
 * see no runtime difference.
 */
export declare function parseClaudeTranscript(content: string): StructuredTranscript;
//# sourceMappingURL=claude-transcript-parser.d.ts.map