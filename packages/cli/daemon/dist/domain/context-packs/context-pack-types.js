// Rig Context / Composable Context Injection v0 (PL-014) — typed primitive
// shared types.
//
// A context_pack is a directory containing `manifest.yaml` + included
// markdown / yaml / txt files. Operator-authored, library-discoverable,
// reviewable, sendable. Parallel to skills + workflow_specs in shape.
//
// MVP single-host context: storage filesystem-canonical at
// <context.root>/<ref>/ (host; default $OPENRIG_HOME/context) + workspace-local
// .openrig/context-packs/<name>/. NO new SQLite tables; library cache
// is in-memory at the daemon scope.
// OPR.0.5.3.5 mini-req 1 — the founder taxonomy and world anatomy the atom
// schema speaks (SPEC.md design context; intake DESIGN-INTAKE-ATOM-SCHEMA).
// OPR.0.5.6.10 makes the same enum first-class at PACK level: every manifest
// answers "what kind of context am I" through this one definition site.
export const ATOM_TAXONOMIES = ["world", "lore", "skills", "mission"];
/** OPR.0.5.6.10 mini-req 2 — the classification teaching shared by every
 *  refusal surface (daemon parser, CLI install validator): the legal values
 *  and one sentence of meaning each (the coining-session definitions). */
export const TAXONOMY_TEACHING = `Legal values: ${ATOM_TAXONOMIES.join(" | ")}. ` +
    "world = where you are (the environment: entities, rules, affordances); " +
    "lore = what has been learned here (position knowledge earned in place); " +
    "skills = what you know how to do (procedural capability); " +
    "mission = what you are doing now (the current work and its intent). " +
    "Add one line to manifest.yaml, e.g. `taxonomy: skills`.";
export const ATOM_REGIONS = ["identity", "ontology", "terrain", "actors", "laws", "history", "state", "affordances"];
export const ATOM_SITUATIONS = ["fresh", "handover", "post-compaction"];
export const ATOM_PURPOSES = ["depth", "width"];
export const ATOM_RUNTIMES = ["claude", "codex", "any"];
export const ATOM_PRIORITIES = ["core", "recommended", "optional"];
export const CONTEXT_PROFILE_RUNTIMES = ["claude", "codex"];
export const CONTEXT_PROFILE_SOURCES = ["project", "mission", "seat", "slice"];
export class ContextPackError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "ContextPackError";
    }
}
//# sourceMappingURL=context-pack-types.js.map