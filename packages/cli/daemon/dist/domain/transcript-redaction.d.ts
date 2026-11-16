/** v0 secret-pattern list. Mirrors packages/cli/src/restore-packet/redaction.ts:31-37. */
export declare const TRANSCRIPT_SECRET_PATTERNS: readonly RegExp[];
/**
 * Apply the openrig-v0 redaction policy to transcript content. Returns
 * the input with each match of the secret patterns replaced by the
 * literal string `[REDACTED]`. Pure function; no side effects.
 *
 * Used by GET /api/transcripts/:session/full to redact the wire payload
 * BEFORE serialization, so credential patterns never reach the response
 * body even when a transcript file contains them.
 */
export declare function redactTranscriptContent(text: string): string;
//# sourceMappingURL=transcript-redaction.d.ts.map