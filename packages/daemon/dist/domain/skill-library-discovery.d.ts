import type { AllowlistRoot } from "./files/path-safety.js";
export type LibrarySkillSource = "workspace" | "openrig-managed";
export interface LibrarySkillFile {
    /** Filename only (no directory prefix). */
    name: string;
    /** Path relative to the skill folder root (e.g., "SKILL.md" or "examples/basic.md"). */
    path: string;
    /** File size in bytes. */
    size: number;
    /** Last-modified ISO timestamp. */
    mtime: string;
}
export interface LibrarySkill {
    /**
     * Stable id including source + relative path within the source tree.
     * Examples:
     *   "openrig-managed:claude-compact-in-place" (flat skill at shared root)
     *   "openrig-managed:core/openrig-user" (nested skill inside category)
     *   "workspace:.openrig/skills/operator-skill" (workspace skill)
     * Stable across daemon restarts as long as the disk layout is unchanged.
     */
    id: string;
    /** Leaf skill folder name (e.g., "openrig-user"). */
    name: string;
    source: LibrarySkillSource;
    /** Top-level markdown files in the skill folder (SKILL.md first if present). */
    files: LibrarySkillFile[];
    /** Absolute filesystem path to the skill folder. Slice 29 HG-4: surfaced
     *  in the public response so operators see where the daemon reads each
     *  skill from. The routes layer also uses this for the
     *  /api/skills/:id/files/{list,read} endpoints. */
    absolutePath: string;
}
/** Public response shape — preserves absolutePath for operator visibility
 *  (slice 29 HG-4 file-path discoverability). */
export type LibrarySkillPublic = LibrarySkill;
export interface SkillLibraryDiscoveryOpts {
    /**
     * Absolute path to the daemon-installed shared-skills directory
     * (typically `<daemon-install>/specs/agents/shared/skills`).
     * Resolved by startup.ts via import.meta.url + relative resolve.
     */
    sharedSkillsDir: string;
    /**
     * Workspace allowlist roots (operator-declared via OPENRIG_FILES_ALLOWLIST).
     * Workspace skills live at `<allowlist-root>/.openrig/skills/<skill-name>/`.
     * Empty array → no workspace-source skills discovered (managed-only mode).
     */
    filesAllowlist: AllowlistRoot[];
}
export declare class SkillLibraryDiscoveryService {
    private readonly opts;
    constructor(opts: SkillLibraryDiscoveryOpts);
    /**
     * Returns the consolidated list of OpenRig-managed + workspace skills.
     * Sources scanned:
     *   - opts.sharedSkillsDir (daemon-known absolute path; openrig-managed)
     *   - <opts.filesAllowlist root>/.openrig/skills/ for each root (workspace)
     * Dedupe rule: managed wins over workspace when (source-key-collision).
     * v0 collision shape is unusual; defensive only.
     */
    listLibrarySkills(): LibrarySkill[];
    /** Lookup a single skill by its stable id. */
    getSkill(id: string): LibrarySkill | null;
    /** Public-facing list (strips absolutePath from each entry). */
    listLibrarySkillsPublic(): LibrarySkillPublic[];
}
//# sourceMappingURL=skill-library-discovery.d.ts.map