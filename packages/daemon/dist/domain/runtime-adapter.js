export const ATTENTION_REQUIRED_READINESS_CODES = new Set([
    "trust_gate",
    "hook_trust_gate",
    "update_gate",
    "login_required",
    "mcp_gate",
    "bypass_consent_gate",
    // Codex auth refusal (stored OAuth token can no longer be refreshed).
    // Defensive: row 6's verifyResumeLaunch patch propagates attention_required
    // through the launch path so the readiness fallback shouldn't see this code,
    // but adding it here keeps the two paths semantically aligned.
    "codex_auth_refusal",
    "codex_client_incompatible",
]);
export function isAttentionRequiredReadinessCode(code) {
    return !!code && ATTENTION_REQUIRED_READINESS_CODES.has(code);
}
// -- Shared concrete-hint resolver --
/**
 * Resolve 'auto' delivery hint to a concrete hint.
 * Single source of truth — used by both the startup partition and adapter delivery.
 * Rules match existing adapter logic byte-for-byte.
 */
export function resolveConcreteHint(path, content) {
    if (path.endsWith("SKILL.md") || content.startsWith("# SKILL"))
        return "skill_install";
    if (path.endsWith(".md"))
        return "guidance_merge";
    return "send_text";
}
//# sourceMappingURL=runtime-adapter.js.map