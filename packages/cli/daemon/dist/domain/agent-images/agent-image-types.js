// Fork Primitive + Starter Agent Images v0 (PL-016) — typed primitive
// parallel to skills + workflow_specs + context_packs (PL-014).
//
// An agent_image is a snapshot bundle of a productive seat's
// resumable state — runtime-specific resume token (Claude resume_token
// / Codex thread_id), source-seat lineage, optional cwd-deltas + notes
// — surfaced in the Specs library and consumable by AgentSpec
// `session_source: mode: agent_image, ref: { kind: image_name, ... }`.
// Storage at ~/.openrig/agent-images/<name>/ + workspace-local
// .openrig/agent-images/<name>/.
//
// MVP single-host context: filesystem-canonical; NO new SQLite tables;
// library cache is in-memory at the daemon scope.
export class AgentImageError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "AgentImageError";
    }
}
//# sourceMappingURL=agent-image-types.js.map