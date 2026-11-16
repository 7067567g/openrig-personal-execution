export type PolicySurface = "flag" | "config";
export type PolicySource = "builtin" | "custom";
export type LaunchPosture = "floor" | "full_bypass" | "auto";
export type DefaultPosture = "allow" | "ask" | "deny";
/** A parsed policy spec: the raw frontmatter object + the preserved Markdown body. */
export interface ParsedPolicySpec {
    frontmatter: Record<string, unknown>;
    /** The Markdown body after the frontmatter block — preserved verbatim (human prose, not contract). */
    body: string;
}
export interface ParseError {
    error: string;
}
/** Parse a policy spec into its frontmatter contract + preserved body. Never throws. */
export declare function parsePolicySpec(raw: string): ParsedPolicySpec | ParseError;
export interface ValidationResult {
    ok: boolean;
    errors: string[];
}
/**
 * Validate-by-convention: required scalars, enum membership, surface-appropriate EXCLUSIVITY, and
 * scalar/list SHAPES. ADVISORY + fail-open — returns {ok, errors[]}, never throws, never enforces.
 * Does NOT validate the semantic-action vocabulary (taxonomy 668bb0d2 owns it) nor resolve to any
 * harness format.
 */
export declare function validatePolicySpec(fm: Record<string, unknown>): ValidationResult;
/**
 * Deterministic CANONICAL serialization: frontmatter re-emitted in canonical field order (unknown
 * keys preserved, appended stably) + the body verbatim. Round-trip contract = serialize is STABLE
 * (serialize∘parse is idempotent) + SEMANTIC equality (frontmatter deep-equal) + BODY preserved —
 * NOT original-input byte identity.
 */
export declare function serializePolicySpec(parsed: ParsedPolicySpec): string;
//# sourceMappingURL=policy-spec.d.ts.map