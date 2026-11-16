/** The durable session→node binding (the session-registry precedent: latest sessions row
 *  for the canonical name). Canonical session names (dash form, `review-r2@rig`) and node
 *  logical ids (dotted form, `review.r2`) are INDEPENDENT identities — the live fleet has
 *  zero cases where they match — so resolution NEVER string-converts between them. */
export function resolveSessionNodeId(db, session) {
    const row = db
        .prepare("SELECT node_id FROM sessions WHERE session_name = ? ORDER BY id DESC LIMIT 1")
        .get(session);
    return row?.node_id ?? null;
}
/** Default orchestrator derivation: the destination's BOUND node → the source of its
 *  delegates_to edge → that parent node's CURRENT canonical session binding. A session
 *  outside the recorded topology, or a parent with no session binding, resolves to null
 *  (there is no orchestrator session to wake — never synthesize one). */
export function defaultResolveOrchestrator(db, session) {
    const nodeId = resolveSessionNodeId(db, session);
    if (!nodeId)
        return null;
    const row = db
        .prepare(`SELECT s.session_name AS parentSession FROM edges e
         JOIN sessions s ON s.node_id = e.source_id
        WHERE e.target_id = ? AND e.kind = 'delegates_to'
        ORDER BY s.created_at DESC, s.id DESC
        LIMIT 1`)
        .get(nodeId);
    return row?.parentSession ?? null;
}
//# sourceMappingURL=queue-owner.js.map