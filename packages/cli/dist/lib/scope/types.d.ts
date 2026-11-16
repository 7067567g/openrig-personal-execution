/** Scope tiers. v0 ships `mission` + `slice`; `project` and `sub-slice`
 *  exist in the grammar but have no CLI verbs yet. */
export type ScopeTier = "project" | "mission" | "slice" | "sub-slice";
/** Stable reference ID parts. `OPR.0.3.2.12` → project="OPR",
 *  version="0.3.2", n=12. Escape-band non-release missions look like
 *  `OPR.99.0.1` → version="99.0.1", n=undefined. */
export interface DotId {
    project: string;
    version: string;
    n?: number;
    m?: number;
}
export interface MissionInfo {
    /** Mission folder name (e.g., "release-0.3.2", "backlog"). */
    name: string;
    /** Absolute path to the mission folder. */
    absPath: string;
    /** Path to the mission's README.md, if present. */
    readmePath: string | null;
    /** Parsed frontmatter from the README. */
    frontmatter: Record<string, unknown>;
    /** Minted dot-ID for this mission (read from frontmatter if present,
     *  otherwise inferred from the folder name pattern). */
    id: string | null;
    activeSliceCount: number;
    closedSliceCount: number;
}
export interface SliceInfo {
    name: string;
    absPath: string;
    readmePath: string | null;
    frontmatter: Record<string, unknown>;
    /** "NN-slug" → NN. */
    nn: number | null;
    /** "NN-slug" → slug. */
    slug: string | null;
    missionName: string;
    /** Minted dot-ID, parent.NN form. */
    id: string | null;
    /** Frontmatter `status` field, lowercased. */
    status: string | null;
}
/** 3-part error shape per `building-agent-software` skill §3.6. */
export declare class ScopeCliError extends Error {
    readonly fact: string;
    readonly consequence: string;
    readonly action: string;
    constructor(opts: {
        fact: string;
        consequence: string;
        action: string;
    });
}
export type SliceState = "active" | "closed" | "shipped" | "all";
export type SliceTemplateKind = "placeholder" | "bug-fix" | "backlog-deprecation" | "backlog-tech-debt" | "release-feature" | "research";
export declare const SLICE_TEMPLATE_KINDS: ReadonlyArray<SliceTemplateKind>;
export type MissionTemplateKind = "placeholder" | "release";
export declare const MISSION_TEMPLATE_KINDS: ReadonlyArray<MissionTemplateKind>;
export type CloseReason = "wontfix" | "deferred" | "superseded" | "stale";
export declare const CLOSE_REASONS: ReadonlyArray<CloseReason>;
/** OPR.0.4.1.6 — the scope-and-versioning §2 epistemic-maturity `stage` enum
 *  (4 rungs + 2 exits). The ONLY valid stage values; invented values
 *  (shape/shaped/draft) are rejected. `superseded` must name its successor;
 *  `retired` means do-not-use. */
export type Stage = "wip" | "provisional" | "established" | "canonical" | "superseded" | "retired";
export declare const STAGE_VALUES: ReadonlyArray<Stage>;
//# sourceMappingURL=types.d.ts.map