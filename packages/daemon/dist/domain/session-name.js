// Session naming: canonical pod-aware format + legacy flat-node format.
// Canonical: {pod}-{member}@{rig} — human-authored, system-validated.
// Legacy: r{NN}-{suffix} — for flat rigs without pods.
const LEGACY_SESSION_NAME_PATTERN = /^r\d{2}-.+$/;
const MANAGED_STEM_PATTERN = /^r\d{2}(?:-|$)/;
const ALLOWED_CHARS_PATTERN = /^[a-zA-Z0-9\-_.@]+$/;
/**
 * Derive a canonical session name from pod, member, and rig name.
 * Pure concatenation — no normalization, no heuristics.
 */
export function deriveCanonicalSessionName(podName, memberName, rigName) {
    return `${podName}-${memberName}@${rigName}`;
}
/**
 * Legacy session-name derivation for flat rigs without pods.
 * Dots in logicalId are normalized to underscores (tmux compat).
 */
export function deriveSessionName(rigName, logicalId) {
    const stem = MANAGED_STEM_PATTERN.test(rigName) ? rigName : `r00-${rigName}`;
    // tmux replaces dots with underscores in session names — normalize to match
    const safeId = logicalId.replace(/\./g, "_");
    return `${stem}-${safeId}`;
}
/**
 * Validate a session name. Accepts both:
 * - Legacy: r{NN}-{suffix}
 * - Canonical: {something}@{something} with all chars in allowed set
 * Both branches enforce the allowed character set.
 */
export function validateSessionName(name) {
    if (!name || !ALLOWED_CHARS_PATTERN.test(name))
        return false;
    // Canonical: contains @
    if (name.includes("@"))
        return true;
    // Legacy: r{NN}-{suffix}
    return LEGACY_SESSION_NAME_PATTERN.test(name);
}
/**
 * Validate characters in a session name component.
 * Returns null if valid, or an error string with the specific invalid character.
 */
export function validateSessionNameChars(value, label) {
    if (!value)
        return `${label} must not be empty`;
    for (const ch of value) {
        if (!ALLOWED_CHARS_PATTERN.test(ch)) {
            return `${label} "${value}" contains "${ch}" — tmux session names allow: a-z, A-Z, 0-9, -, _, ., @`;
        }
    }
    return null;
}
/**
 * Validate all three components of a canonical session name.
 * Returns an array of errors (empty if valid).
 */
export function validateSessionComponents(podName, memberName, rigName) {
    const errors = [];
    if (!podName) {
        errors.push("pod name must not be empty");
    }
    else {
        const err = validateSessionNameChars(podName, "pod name");
        if (err)
            errors.push(err);
        if (podName.includes("@")) {
            errors.push('pod name must not contain "@" — it separates the member from the rig');
        }
    }
    if (!memberName) {
        errors.push("member name must not be empty");
    }
    else {
        const err = validateSessionNameChars(memberName, "member name");
        if (err)
            errors.push(err);
        if (memberName.includes("@")) {
            errors.push('member name must not contain "@" — it separates the member from the rig');
        }
    }
    if (!rigName) {
        errors.push("rig name must not be empty");
    }
    else {
        const err = validateSessionNameChars(rigName, "rig name");
        if (err)
            errors.push(err);
    }
    return errors;
}
const HUMAN_SEAT_SESSION_REF_PATTERN = /^human(?:-[A-Za-z0-9._-]+)?@(kernel|host)$/;
const LEGACY_FLAT_SESSION_PATTERN = /^r\d{2}-.+$/;
// A2 4th leg — CLOSED virtual-domain token set as a NAMED CONSTANT beside the
// pattern (arch: not inline alternation; lexical-only pure fn, no state/IO).
// Future domain words extend this array (e.g. @a2a) as explicit alternation.
// Admission (is this @external ref registered?) is NOT here — it is the A1/A4
// gateway's job; the classifier only recognizes the lexical shape.
export const VIRTUAL_DOMAIN_TOKENS = ["external"];
const VIRTUAL_DOMAIN_SESSION_REF_PATTERN = new RegExp(`^[A-Za-z0-9._:-]+@(${VIRTUAL_DOMAIN_TOKENS.join("|")})$`);
/** Arch tooth 1: human-CLASS classification runs BEFORE any parse at sites where
 *  the human/agent distinction matters (the queue-destination gate + attention
 *  union). A2 widened it: virtual-domain refs (<local>@external) are human-CLASS
 *  too (they join human-route enforcement; NEVER a silent agent-class downgrade).
 *  Admission stays at the A1/A4 gateway. */
export function isHumanSeatSessionRef(sessionRef) {
    return HUMAN_SEAT_SESSION_REF_PATTERN.test(sessionRef) ||
        VIRTUAL_DOMAIN_SESSION_REF_PATTERN.test(sessionRef);
}
export function parseSessionName(raw) {
    // Precedence (arch): human -> EXTERNAL -> canonical -> legacy -> malformed. The
    // virtual-domain leg MUST precede canonical, else "mike@external" parses as
    // member=mike rig=external; A1's rig-name reservation keeps that unambiguous.
    if (VIRTUAL_DOMAIN_SESSION_REF_PATTERN.test(raw)) {
        const domainAt = raw.lastIndexOf("@");
        return { kind: "external", local: raw.slice(0, domainAt), domain: raw.slice(domainAt + 1) };
    }
    const at = raw.indexOf("@");
    if (at > 0 && at < raw.length - 1) {
        return { kind: "canonical", member: raw.slice(0, at), rig: raw.slice(at + 1) };
    }
    if (at === -1 && LEGACY_FLAT_SESSION_PATTERN.test(raw)) {
        return { kind: "legacy", name: raw };
    }
    return { kind: "malformed", error: "malformed_session_name", input: raw };
}
/** Display: the member/local leg — text before the first "@", or the whole
 *  string when no "@" is present (the shipped split("@")[0] rendering,
 *  verbatim: "@rig" yields ""). */
export function sessionMemberLabel(session) {
    const at = session.indexOf("@");
    return at === -1 ? session : session.slice(0, at);
}
/** Routing/grouping: the rig leg of a canonical name, else undefined. */
export function sessionRigOf(session) {
    const parsed = parseSessionName(session);
    return parsed.kind === "canonical" ? parsed.rig : undefined;
}
//# sourceMappingURL=session-name.js.map