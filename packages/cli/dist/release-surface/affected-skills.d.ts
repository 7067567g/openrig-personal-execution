import type { SurfaceDiff } from "./surface-diff.js";
/**
 * Split a command token into path segments, stripping a leading `rig ` and
 * collapsing internal whitespace. `"rig scope slice create"` -> `["scope",
 * "slice", "create"]`; `"queue create"` -> `["queue", "create"]`.
 */
export declare function toSegments(token: string): string[];
/**
 * The section-3 changed-surface set: every command-path string a release touched,
 * expanded from the diff's bare-top-level + subcommand-list grammar. This is
 * the AC-3a target (validated against 13.1's shipped sample diff + fixture).
 */
export declare function expandChangedSurface(diff: SurfaceDiff): Set<string>;
/**
 * Component-wise prefix match in EITHER direction: true iff one segment-list
 * equals OR is a path-segment prefix of the other. Compares segment-by-segment
 * up to the shorter length - so `["scope"]` matches `["scope","slice","create"]`
 * (and vice-versa), but `["up"]` does NOT match `["update"]` (distinct first
 * segment). This is the advisor sharpening over raw-string prefix.
 */
export declare function pathsMatch(a: string[], b: string[]): boolean;
/** Does a skill token match any path in the changed-surface set? */
export declare function skillTokenMatches(skillToken: string, changedSurface: Set<string>): boolean;
export interface SkillIndexEntry {
    /** Skill directory name (the canonical skill id). */
    name: string;
    /** The skill's `metadata.cli_surfaces_referenced` tokens (13.1 grammar). */
    cliSurfacesReferenced: string[];
}
/**
 * AC-3b: the affected-skill output. A skill is affected iff ANY of its
 * `cli_surfaces_referenced` tokens matches the changed-surface set. Returns a
 * sorted, de-duplicated list of skill names - deterministic for a given
 * (diff, skills) pair (AC-4).
 */
export declare function computeAffectedSkills(diff: SurfaceDiff, skills: SkillIndexEntry[]): string[];
/**
 * Parse `metadata.cli_surfaces_referenced` from a SKILL.md frontmatter block.
 * Returns [] when there is no frontmatter, no metadata block, or the field is
 * absent/malformed (a skill with no CLI surfaces simply isn't in the index).
 */
export declare function parseCliSurfaces(skillMarkdown: string): string[];
/**
 * Load the skill index from a skills-root directory (offline fs read). Each
 * immediate subdirectory holding a SKILL.md with a non-empty
 * `cli_surfaces_referenced` becomes one index entry. Sorted by name.
 */
export declare function loadSkillIndex(skillsRoot: string): SkillIndexEntry[];
//# sourceMappingURL=affected-skills.d.ts.map