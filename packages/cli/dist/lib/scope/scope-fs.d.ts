import type { MissionInfo, SliceInfo, SliceState } from "./types.js";
import { DEFAULT_PROJECT_PREFIX } from "./dot-id.js";
import { type MissionDependencyGraph } from "./scope-audit.js";
/** Split a markdown file into [frontmatter, body]. Returns `[{}, content]`
 *  when no frontmatter delimiter is present. */
export declare function splitFrontmatter(content: string): {
    frontmatter: Record<string, unknown>;
    body: string;
};
/** Re-stitch frontmatter + body into a single markdown string. */
export declare function joinFrontmatter(frontmatter: Record<string, unknown>, body: string): string;
/** Read + parse frontmatter from a markdown file. Returns `{}` if the
 *  file is missing OR has no frontmatter (graceful for placeholder
 *  missions that pre-date the convention). */
export declare function readFrontmatter(absPath: string): Record<string, unknown>;
/** Update specific keys in a markdown file's frontmatter. The writer owns only
 *  those keys in valid mappings, preserving inline comments and unowned bytes.
 *  Invalid mappings retain the legacy line-based update with a warning. Valid
 *  mappings are matched by decoded YAML key identity and spliced by source range;
 *  re-serializing the whole block destroys author quoting, folded scalars,
 *  ordering, and therefore any hash derived before a repair. */
export declare function updateFrontmatter(absPath: string, updates: Record<string, unknown>): void;
/**
 * The typed `workspace.slices_root` setting, when it is a readable directory;
 * null when it is unset or unreadable. The fallback every command resolves to
 * when the caller names no workspace of its own.
 */
export declare function configuredMissionsRoot(configPath?: string): string | null;
/**
 * The project's missions root: project.yaml's optional `missions.root` when it is a relative path inside the
 * project, else the conventional `missions`. Null when it resolves outside the project. Work positions and
 * mission creation both use it, so they agree on where a project's missions live.
 */
export declare function projectMissionsRoot(projectRoot: string, projectManifest: Record<string, unknown> | null, warnings: string[]): string | null;
/** {@link projectMissionsRoot} for the project.yaml at `projectRoot`, when there is one. */
export declare function readProjectMissionsRoot(projectRoot: string, warnings: string[]): string | null;
/** Locate the missions root from an explicit workspace override or the typed
 * `workspace.slices_root` setting. No cwd walk: discovery may enumerate
 * candidates, but selection comes from configuration. */
export declare function resolveMissionsRoot(opts?: {
    override?: string | null;
    cwd?: string;
    configPath?: string;
    /**
     * Fail instead of falling back to the configured root when an explicit
     * override (`--workspace` or OPENRIG_WORK_ROOT) names no missions tree.
     * A caller that writes to the root it resolved wants the refusal: the silent
     * fallback would operate on a tree the caller never named (#995).
     */
    strictOverride?: boolean;
}): string;
/**
 * The authored contract file at a work node, most-preferred first.
 *
 * `SPEC.md` is the current name; `README.md` is the legacy one and stays valid indefinitely. There
 * is no migration: dormant missions and historical proof receipts are README-backed and must keep
 * resolving untouched. A node carrying both is not an error here — SPEC.md wins and `scope audit`
 * advises about the second file.
 */
export declare const NODE_FILE_PRECEDENCE: readonly ["SPEC.md", "README.md"];
/** Current mission notes name followed by the indefinitely-readable legacy name. */
export declare const NOTES_FILE_PRECEDENCE: readonly ["NOTES.md", "MISSION_NOTES.md"];
export interface NotesFileResolution {
    path: string;
    name: (typeof NOTES_FILE_PRECEDENCE)[number];
}
/** Resolve the first readable mission notes file, preferring the current name. */
export declare function resolveNotesFile(absPath: string): NotesFileResolution | null;
/**
 * Resolve a work node's authored contract file, or null when the directory declares no node.
 *
 * Null is the "not a declared mission/slice" signal every caller already keys on — this changes
 * WHICH filenames count, never what absence means.
 */
export declare function resolveNodeFile(absPath: string): string | null;
/** List mission folders under the missions root. A mission is any
 *  top-level folder containing an authored node file (SPEC.md, or legacy
 *  README.md). Directories with
 *  neither are skipped — they represent scratch/junk, not declared missions. */
export declare function listMissions(missionsRoot: string): MissionInfo[];
/** Resolve a mission by name OR path relative to the missions root.
 *  Throws ScopeCliError on miss OR when the directory exists but lacks an
 *  authored node file. Node-less dirs are scratch/junk, not declared missions,
 *  so mutation commands must not silently target them. */
export declare function findMission(missionsRoot: string, identifier: string): MissionInfo;
export declare function listSlices(mission: MissionInfo, state: SliceState): SliceInfo[];
/** Read the advisory sibling-ordering graph for one mission. Unknown, stale,
 * malformed, or cross-parent edges are reported and ignored: the graph is a
 * sequencing hint, never a gate or a traversal pointer. */
export declare function buildMissionDependencyGraph(mission: MissionInfo): MissionDependencyGraph;
/** Resolve a slice path (absolute, relative-to-substrate, or
 *  relative-to-mission) into a SliceInfo. */
export declare function findSlice(missionsRoot: string, slicePath: string, hintMission?: string | null): SliceInfo;
export { tryClaimSliceNN } from "./slice-claims.js";
/** Find the next available NN for a mission's slices/ folder. Scans
 *  BOTH slices/ AND closed/, including ordinal claims, so numbers are never reused (§3.2). */
export declare function nextSliceNN(missionAbsPath: string): number;
/** Mint or read the dot-ID for a mission. If the mission's README has
 *  an `id:` field, return it. Otherwise infer from the folder name
 *  (release-X.Y.Z → OPR.X.Y.Z; otherwise escape band). */
export declare function ensureMissionId(mission: MissionInfo, missionsRoot: string): string;
/** Same as ensureMissionId, but ALSO writes the inferred id back into
 *  the mission's README frontmatter when it was absent. Use this at
 *  every site that mints a child id (slice create / ship / move target)
 *  — per the convention's lazy-adoption rule: when a child is created
 *  under a pre-existing parent with no id, assign the parent's id
 *  on-demand at the same time. Narrow, single-parent, create-triggered;
 *  never mass-migration. */
export declare function ensureMissionIdPersisted(mission: MissionInfo, missionsRoot: string): string;
/** Return the git toplevel for a path, or null if not inside a repo. */
export declare function gitTopLevel(absPath: string): string | null;
/** Refuse to move a path with uncommitted local changes. Catches the
 *  "dirty working tree" risk in §11.1 / §3.4 — `git mv` would silently
 *  carry along the user's in-progress edits. */
export declare function assertCleanWorkingTree(repoRoot: string, relPath: string): void;
/** Move a directory using `git mv` when inside a repo; fall back to
 *  `fs.renameSync` with a warning when not. Returns true if git was
 *  used. */
export declare function moveSlice(srcAbs: string, destAbs: string, opts?: {
    /** Stage the move (default true). git mv stages by default; we
     *  preserve that semantic. */
    commit?: boolean;
}): {
    usedGit: boolean;
    repoRoot: string | null;
};
/** Best-effort inverse used only inside a failed scope composition command. */
export declare function rollbackMovedSlice(srcAbs: string, destAbs: string, move: {
    usedGit: boolean;
    repoRoot: string | null;
}): void;
export declare function todayDateISO(): string;
export declare function pad2(n: number): string;
export { DEFAULT_PROJECT_PREFIX };
//# sourceMappingURL=scope-fs.d.ts.map