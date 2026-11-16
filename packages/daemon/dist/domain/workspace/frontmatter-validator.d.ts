import type { WorkspaceKind } from "../types.js";
export type FrontmatterGapKind = "missing-required-field" | "unrecognized-status-value" | "parse-error" | "missing-frontmatter";
export interface FrontmatterGap {
    filePath: string;
    /** Path relative to the validation root, for stable cross-machine output. */
    relativePath: string;
    kind: FrontmatterGapKind;
    /** Field name when kind === "missing-required-field" or
     *  "unrecognized-status-value"; null otherwise. */
    field: string | null;
    message: string;
    /** Workspace kind the file was validated against (e.g. "knowledge"). */
    workspaceKind: WorkspaceKind | null;
}
export interface FrontmatterValidationReport {
    root: string;
    /** Workspace kind applied to all files under this root. v0: caller picks
     *  one root + one kind per invocation. */
    workspaceKind: WorkspaceKind | null;
    totalFiles: number;
    filesWithFrontmatter: number;
    gapCount: number;
    gaps: FrontmatterGap[];
}
export interface ValidateOpts {
    root: string;
    workspaceKind?: WorkspaceKind;
    /** When true, recurse into subdirectories. Defaults to true. */
    recursive?: boolean;
    /** When true, validate every .md file even if frontmatter is absent
     *  (records a `missing-frontmatter` gap). Defaults to false — files
     *  without `---` are skipped silently (treated as informal notes). */
    requireFrontmatter?: boolean;
    /** Hard cap on files walked. Defaults to 10000. Prevents accidental
     *  multi-GB walks from runaway invocations. */
    maxFiles?: number;
}
/** Run the frontmatter validator. */
export declare function validateWorkspaceFrontmatter(opts: ValidateOpts): FrontmatterValidationReport;
//# sourceMappingURL=frontmatter-validator.d.ts.map