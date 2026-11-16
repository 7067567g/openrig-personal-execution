/**
 * v0 secret-pattern list. Mirrors Velocity prior art `:34-48` exactly:
 *
 * 1. /\bsk-[A-Za-z0-9_-]{16,}\b/g — OpenAI-style secret tokens.
 * 2. /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g — GitHub personal/OAuth tokens.
 * 3. /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g — GitHub fine-grained PATs.
 * 4. /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/g — generic Bearer tokens.
 * 5. /\b[A-Za-z0-9+/]{40,}={0,2}\b/g — base64-shaped strings ≥40 chars.
 */
export declare const SECRET_PATTERNS: readonly RegExp[];
/**
 * Apply the openrig-v0 redaction policy to a string. Returns the input
 * with each match of the secret patterns replaced by the literal
 * string `[REDACTED]`. Pure function; no side effects.
 *
 * The redaction is non-destructive at the structural level — only the
 * matched substrings are replaced. Surrounding characters are kept.
 */
export declare function redact(text: string): string;
/**
 * Returns true if at least one secret pattern matches the input.
 * Used by the omitted-records counter to track how many records had
 * their content redacted (for the `redacted_secrets` omitted-class
 * count in summary).
 *
 * Note: a SINGLE record may match multiple patterns; this returns true
 * after the first match for efficiency.
 */
export declare function hasSecretPattern(text: string): boolean;
//# sourceMappingURL=redaction.d.ts.map