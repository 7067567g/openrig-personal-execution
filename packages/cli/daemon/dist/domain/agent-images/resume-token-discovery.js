// Fork Primitive + Starter Agent Images v0 (PL-016) — runtime-specific
// resume-token discovery.
//
// Given a canonical session name, returns the native conversation id
// the runtime uses for fork/resume. Shared between SnapshotCapturer
// (capture into image) and the /api/agent-images/fork route (one-shot
// fork without snapshot side effect).
//
// Honest failure mode: returns null when no token is available rather
// than fabricating one (docs/as-built/architecture/adapters-and-runtimes.md § Resume honesty).
export function discoverResumeToken(db, sourceSession) {
    const sessionRow = db
        .prepare("SELECT id, node_id, resume_token FROM sessions WHERE session_name = ? ORDER BY id DESC LIMIT 1")
        .get(sourceSession);
    if (!sessionRow) {
        return {
            ok: false,
            failure: {
                code: "session_not_found",
                message: `Source session '${sourceSession}' not found. Run 'rig ps --nodes' to see what's running.`,
            },
        };
    }
    const nodeRow = db
        .prepare("SELECT runtime, cwd FROM nodes WHERE id = ?")
        .get(sessionRow.node_id);
    const runtime = nodeRow?.runtime ?? null;
    const nodeCwd = nodeRow?.cwd ?? null;
    if (runtime !== "claude-code" && runtime !== "codex") {
        return {
            ok: false,
            failure: {
                code: "runtime_unsupported",
                message: `Source session '${sourceSession}' has runtime '${runtime ?? "(unknown)"}' which has no native fork primitive. Only claude-code and codex sessions can be forked.`,
            },
        };
    }
    if (runtime === "claude-code") {
        const contextSessionId = discoverClaudeContextSessionId(db, sessionRow.node_id, sourceSession);
        return {
            ok: true,
            result: { runtime, nativeId: contextSessionId ?? sessionRow.resume_token ?? null, nodeCwd },
        };
    }
    // Codex managed tmux seats persist the captured native thread id on the
    // sessions row after launch. Use it directly for image capture/fork.
    if (sessionRow.resume_token) {
        return { ok: true, result: { runtime, nativeId: sessionRow.resume_token, nodeCwd } };
    }
    // Codex external_cli seats may not have a sessions.resume_token; the
    // external_session_name on the binding row holds the native conversation id.
    const bindingRow = db
        .prepare("SELECT external_session_name, attachment_type FROM bindings WHERE node_id = ?")
        .get(sessionRow.node_id);
    if (bindingRow?.attachment_type === "external_cli" && bindingRow.external_session_name) {
        return { ok: true, result: { runtime, nativeId: bindingRow.external_session_name, nodeCwd } };
    }
    return { ok: true, result: { runtime, nativeId: null, nodeCwd } };
}
function discoverClaudeContextSessionId(db, nodeId, sourceSession) {
    try {
        const row = db
            .prepare(`
        SELECT session_id, session_name
        FROM context_usage
        WHERE node_id = ?
        LIMIT 1
      `)
            .get(nodeId);
        if (!row)
            return null;
        if (row.session_name && row.session_name !== sourceSession)
            return null;
        const nativeId = row.session_id?.trim();
        return nativeId ? nativeId : null;
    }
    catch {
        // Back-compat for minimal test DBs or older stores: fall back to the
        // persisted sessions.resume_token rather than making discovery fail.
        return null;
    }
}
//# sourceMappingURL=resume-token-discovery.js.map