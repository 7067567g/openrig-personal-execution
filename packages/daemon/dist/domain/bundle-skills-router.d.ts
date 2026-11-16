/**
 * Bundle skills router (Item 6 / slice-05 Checkpoint 7.2).
 *
 * Pure function. Copies skill files declared in a bundle manifest's skills[]
 * block from the bundle's extracted tree to the operator skills library.
 * No daemon dependencies — fully unit-testable via FsOps injection.
 *
 * Safety: each declared skill path is treated as untrusted manifest content;
 * the helper rejects paths that escape the bundle tree (path containment
 * check mirrors the bundle-source-resolver pattern). The output target
 * directory is created via mkdirp.
 *
 * Honest-scoping: missing source files surface as warnings in the result
 * (NOT thrown errors) so the install lifecycle can continue with what's
 * available. Same for absent skills library: caller decides to skip-or-fail.
 *
 * /install handler integration lands at Checkpoint 7.3.
 */
/** Filesystem injection point — real impl wraps node:fs. Tests substitute in-memory. */
export interface SkillsRouterFsOps {
    exists: (path: string) => boolean;
    /** Byte-for-byte copy; routed files are never decoded. */
    copyFile: (src: string, dest: string) => void;
    mkdirp: (path: string) => void;
}
/** Inputs to routeSkills. */
export interface RouteSkillsInput {
    /** Absolute path to the bundle's extracted root (tmp dir from unpack). */
    bundleRoot: string;
    /** Relative skill paths declared in the manifest's skills[] block. */
    declaredSkills: string[];
    /** Absolute path to the operator skills library (default ~/.openrig/skills). */
    targetSkillsDir: string;
    /** Optional package-layout prefix removed only from the destination path.
     *  The source path always remains the exact bundle-declared path. */
    targetPrefixToStrip?: string;
}
/** One routed skill (or one rejection). */
export interface RoutedSkillRecord {
    /** Declared path from manifest.skills[]. */
    declaredPath: string;
    /** "routed" = copied successfully; "missing" = source not in bundle;
     * "unsafe" = escapes bundle workspace; "no_library" = target dir not
     * present and caller did not request creation (reserved for future
     * library-reachability mode). */
    status: "routed" | "missing" | "unsafe";
    /** Where the skill landed in the target library (absolute path), if routed. */
    installedAt?: string;
    /** Human-readable detail (3-part error shape input for caller). */
    detail?: string;
}
/** Aggregate routing result. */
export interface RouteSkillsResult {
    records: RoutedSkillRecord[];
    routedCount: number;
    rejectedCount: number;
}
/**
 * Route each declared skill from the bundle tree to the operator skills
 * library. Per-skill safety: resolved source path must stay inside bundleRoot;
 * skipped if missing from bundle. Caller writes the install audit record
 * (Item 4 chain) using the records returned here.
 */
export declare function routeSkills(input: RouteSkillsInput, fs: SkillsRouterFsOps): RouteSkillsResult;
//# sourceMappingURL=bundle-skills-router.d.ts.map