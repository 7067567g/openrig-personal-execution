import type { SourceRuntime } from "./types.js";
/**
 * Detect the source runtime from a sample of JSONL lines.
 *
 * Returns:
 * - "codex" — at least one line has `type: "response_item"` OR
 *   `type: "session_meta"` OR `type: "compacted"`.
 * - "claude-code" — at least one line has `type: "user"` or
 *   `type: "assistant"` AND no Codex markers seen.
 * - null — input is empty / non-JSONL / ambiguous (e.g., neither
 *   marker class appears).
 *
 * Detection is non-greedy: walks the input lines until a definitive
 * marker is found. Bias toward Codex markers if both shape classes
 * appear (extremely unlikely in practice; would indicate a malformed
 * mixed source).
 */
export declare function detectRuntime(content: string): SourceRuntime | null;
//# sourceMappingURL=runtime-detect.d.ts.map