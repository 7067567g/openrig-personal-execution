export type CheckboxStatus = "active" | "done" | "blocked" | "unknown";
export interface ProgressRow {
    /** 1-based source line number. */
    line: number;
    /** Indent depth (0 = top-level; nested by 2-space indent / Markdown heading depth). */
    depth: number;
    /** Parsed status from the `[x]` / `[ ]` / `[~]` syntax. */
    status: CheckboxStatus;
    /** The text after the checkbox (or the heading text when this row is a heading). */
    text: string;
    /** "checkbox" for `[ ]` lines; "heading" for `##` / `###`. */
    kind: "checkbox" | "heading";
}
export interface ProgressFileNode {
    /** Operator-supplied scan-root display name. */
    rootName: string;
    /** Path relative to the scan root (e.g., "missions/foo/PROGRESS.md"). */
    relPath: string;
    /** Canonical absolute path on disk (handy for the UI's "open in editor" affordance). */
    absolutePath: string;
    mtime: string;
    rows: ProgressRow[];
    /** Top-level title (from frontmatter or first H1). */
    title: string | null;
    /** Aggregate counts derived from rows (kind === "checkbox"). */
    counts: {
        total: number;
        done: number;
        blocked: number;
        active: number;
    };
}
export interface ProgressScanRoot {
    name: string;
    canonicalPath: string;
}
export interface ProgressTreeResult {
    files: ProgressFileNode[];
    /** Aggregate over all files. */
    aggregate: {
        totalFiles: number;
        totalRows: number;
        totalDone: number;
        totalBlocked: number;
        totalActive: number;
    };
    /** Roots that were scanned (for the UI to render "scanned N roots"). */
    scannedRoots: ProgressScanRoot[];
}
/**
 * Decodes a raw `name:/abs/path,...` progress-roots string into a
 * ProgressScanRoot[]. Same semantics as decodeAllowlist in path-safety;
 * keep them parallel. Used by both the env-only legacy path and the
 * settings-resolved (env > file > empty) path.
 */
export declare function decodeProgressScanRoots(raw: string): ProgressScanRoot[];
export declare function readProgressRootsFromEnv(env?: NodeJS.ProcessEnv): ProgressScanRoot[];
export interface ProgressIndexerOpts {
    roots: ProgressScanRoot[];
    /** Override max recursion depth for tests. */
    maxDepth?: number;
}
export declare class ProgressIndexer {
    private readonly roots;
    private readonly maxDepth;
    constructor(opts: ProgressIndexerOpts);
    isReady(): boolean;
    scan(): ProgressTreeResult;
    private walkRoot;
    private walkDir;
    private parseProgressFile;
}
//# sourceMappingURL=progress-indexer.d.ts.map