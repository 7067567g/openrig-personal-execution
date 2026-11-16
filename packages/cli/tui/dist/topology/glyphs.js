export function statusGlyph(data) {
    const activity = data.agentActivity?.state;
    if (data.startupStatus === "failed" || data.status === "failed" || data.status === "stopped")
        return { glyph: "✕", token: "error", overlay: null };
    if (data.startupStatus === "attention_required" || data.heldReason != null || activity === "needs_input")
        return {
            glyph: "◐",
            token: "actAttention",
            overlay: data.contextUsedPercentage != null ? `${Math.round(data.contextUsedPercentage)}%` : null,
        };
    if (data.startupStatus === "ready" && data.status === "running") {
        // S19 MR3: ACTIVITY splits the ● bucket by color ROLE (glyph honesty
        // unchanged) — actively-working vs idle are visibly distinct
        const working = activity === "running" || data.terminalActive === true;
        return { glyph: "●", token: working ? "actActive" : "actIdle", overlay: null };
    }
    // everything else — pending, queued, detached, no session — is the honest
    // ○ bucket, rendered wherever the projection has no value (role: detached)
    return { glyph: "○", token: "actDetached", overlay: null };
}
/** S19 round-4 (guard finding 4): the EXPLORER row's status glyph+role,
 * folded from the SERVED AgentRow status vocabulary (hydrate.toAgentRow
 * derives it verbatim from the projection: failed / attention_required /
 * needs_input / active / idle / sessionStatus-or-"unknown"; the demo fixture
 * additionally uses the legacy "needs-attention" spelling). Same honest
 * 4-glyph vocabulary + activity roles as the topology statusGlyph — anything
 * not positively known renders ○, never a fabricated ●. */
export function rowStatusGlyph(agent) {
    const s = agent.status;
    if (s === "failed")
        return { glyph: "✕", token: "error" };
    if (s === "attention_required" || s === "needs_input" || s === "needs-attention")
        return { glyph: "◐", token: "actAttention" };
    if (s === "active")
        return { glyph: "●", token: "actActive" };
    if (s === "idle")
        return { glyph: "●", token: "actIdle" };
    return { glyph: "○", token: "actDetached" };
}
export function edgeToken(kind) {
    if (kind === "delegates_to")
        return "accent";
    if (kind === "collaborates_with")
        return "ok";
    if (kind === "escalates_to")
        return "warn";
    return "dim";
}
//# sourceMappingURL=glyphs.js.map