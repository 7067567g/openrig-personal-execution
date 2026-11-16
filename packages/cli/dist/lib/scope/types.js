// release-0.3.2 slice 12 — scope CLI primitive types.
//
// Aligned with the substrate convention at
// `openrig-work/conventions/scope-and-versioning/README.md` (stage:
// provisional, authored 2026-05-15). The CLI mints stable dot-IDs
// into created mission/slice frontmatter per §1 of that convention.
/** 3-part error shape per `building-agent-software` skill §3.6. */
export class ScopeCliError extends Error {
    fact;
    consequence;
    action;
    constructor(opts) {
        super(`${opts.fact}\n${opts.consequence}\n${opts.action}`);
        this.name = "ScopeCliError";
        this.fact = opts.fact;
        this.consequence = opts.consequence;
        this.action = opts.action;
    }
}
export const SLICE_TEMPLATE_KINDS = [
    "placeholder",
    "bug-fix",
    "backlog-deprecation",
    "backlog-tech-debt",
    "release-feature",
    "research",
];
export const MISSION_TEMPLATE_KINDS = [
    "placeholder",
    "release",
];
export const CLOSE_REASONS = [
    "wontfix",
    "deferred",
    "superseded",
    "stale",
];
export const STAGE_VALUES = [
    "wip",
    "provisional",
    "established",
    "canonical",
    "superseded",
    "retired",
];
//# sourceMappingURL=types.js.map