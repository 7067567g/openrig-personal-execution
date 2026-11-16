/**
 * Derive a canonical session name from pod, member, and rig name.
 * Pure concatenation — no normalization, no heuristics.
 */
export declare function deriveCanonicalSessionName(podName: string, memberName: string, rigName: string): string;
/**
 * Legacy session-name derivation for flat rigs without pods.
 * Dots in logicalId are normalized to underscores (tmux compat).
 */
export declare function deriveSessionName(rigName: string, logicalId: string): string;
/**
 * Validate a session name. Accepts both:
 * - Legacy: r{NN}-{suffix}
 * - Canonical: {something}@{something} with all chars in allowed set
 * Both branches enforce the allowed character set.
 */
export declare function validateSessionName(name: string): boolean;
/**
 * Validate characters in a session name component.
 * Returns null if valid, or an error string with the specific invalid character.
 */
export declare function validateSessionNameChars(value: string, label: string): string | null;
/**
 * Validate all three components of a canonical session name.
 * Returns an array of errors (empty if valid).
 */
export declare function validateSessionComponents(podName: string, memberName: string, rigName: string): string[];
export type ParsedSessionName = {
    kind: "canonical";
    member: string;
    rig: string;
} | {
    kind: "legacy";
    name: string;
} | {
    kind: "external";
    local: string;
    domain: string;
} | {
    kind: "malformed";
    error: "malformed_session_name";
    input: string;
};
export declare const VIRTUAL_DOMAIN_TOKENS: readonly ["external"];
/** Arch tooth 1: human-CLASS classification runs BEFORE any parse at sites where
 *  the human/agent distinction matters (the queue-destination gate + attention
 *  union). A2 widened it: virtual-domain refs (<local>@external) are human-CLASS
 *  too (they join human-route enforcement; NEVER a silent agent-class downgrade).
 *  Admission stays at the A1/A4 gateway. */
export declare function isHumanSeatSessionRef(sessionRef: string): boolean;
export declare function parseSessionName(raw: string): ParsedSessionName;
/** Display: the member/local leg — text before the first "@", or the whole
 *  string when no "@" is present (the shipped split("@")[0] rendering,
 *  verbatim: "@rig" yields ""). */
export declare function sessionMemberLabel(session: string): string;
/** Routing/grouping: the rig leg of a canonical name, else undefined. */
export declare function sessionRigOf(session: string): string | undefined;
//# sourceMappingURL=session-name.d.ts.map