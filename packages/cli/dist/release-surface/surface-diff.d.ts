import { type Surface } from "./extract-surface.js";
export interface AddedCommand {
    name: string;
    subcommands: string[];
}
export interface AddedFlagsEntry {
    command: string;
    flags?: string[];
    subcommands?: string[];
}
export interface SurfaceDiff {
    release_from: string;
    release_to: string;
    added_commands: AddedCommand[];
    added_flags: AddedFlagsEntry[];
    removed_or_renamed: string[];
}
/** Honest 3-part error matching the repo's CLI error shape (queue.ts:88-111). */
export declare class SurfaceParserError extends Error {
    readonly fact: string;
    readonly consequence: string;
    readonly action: string;
    constructor(parts: {
        fact: string;
        consequence: string;
        action: string;
    });
}
export declare function resolveRepoRoot(cwd: string): string;
/** Pure diff of two extracted surfaces into the slice-13 YAML shape. */
export declare function computeDiff(from: Surface, to: Surface, releaseFrom: string, releaseTo: string): SurfaceDiff;
export declare function generateSurfaceDiff(opts: {
    from?: string;
    to?: string;
    cwd?: string;
    repoRoot?: string;
}): SurfaceDiff;
/** Deterministic YAML serialization (stable key + element order). */
export declare function diffToYaml(diff: SurfaceDiff): string;
//# sourceMappingURL=surface-diff.d.ts.map