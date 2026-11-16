export interface ArtifactPoolSpec {
    /** Absolute path to the pool directory. POC contract: one path per pool. */
    path?: string;
    /** Convenience array form; expanded to one pool per path. */
    paths?: string[];
    /** File extensions to include (default: ['.md']). */
    extensions?: string[];
    /** Filter on frontmatter `status:` field. Empty/absent = include all. */
    include_statuses?: string[];
    /** Frontmatter field used for keying artifacts (default: 'entry'). */
    key_field?: string;
    /** Per-pool extra ignore names (added to defaults). */
    ignore_names?: string[];
    /** When true, descend into subdirectories. Default false. */
    recursive?: boolean;
    /**
     * When true, artifacts whose frontmatter cannot be parsed are still
     * included with empty frontmatter. Default false: malformed frontmatter
     * causes the artifact to be excluded (matches POC behavior so that
     * agents do not get woken about half-written drafts).
     */
    include_malformed_frontmatter?: boolean;
}
export interface ScannedArtifact {
    /** Absolute path to the artifact file. */
    path: string;
    /** The pool path that produced this artifact. */
    pool_path: string;
    /** Full file content (used by edge-artifact-required body-match). */
    raw: string;
    /**
     * Parsed YAML frontmatter (top-level keys). Values are kept as `unknown`
     * because YAML scalars are heterogeneous: timestamps parse to Date,
     * URLs to string, numbers to number, etc. Frontmatter consumers in
     * the policy layer (status filter, key_field lookup) coerce to string.
     */
    frontmatter: Record<string, unknown>;
    /** Parse error message when include_malformed_frontmatter=true; else null. */
    frontmatter_parse_error: string | null;
    /** Convenience accessor for frontmatter.status; null when absent. */
    status: string | null;
}
/**
 * Scan one or more artifact pools per spec(s). Mirrors POC
 * `scanArtifactPools(pools)`. Returns the flat union of matches across
 * all pools, sorted by absolute path. Missing pools yield empty.
 *
 * Throws if `pools` is undefined / empty / shapeless — POC contract:
 * the policy spec MUST declare at least one pool.
 */
export declare function scanArtifactPools(pools: ArtifactPoolSpec | ArtifactPoolSpec[] | undefined): Promise<ScannedArtifact[]>;
/**
 * Format an artifact list as bullet lines. Mirrors POC formatArtifactList:
 * `- /full/absolute/path`. The POC favors the full path so receivers can
 * cd / open / cat the artifact directly without further lookup.
 */
export declare function formatArtifactList(artifacts: ScannedArtifact[], maxItems: number): string;
/**
 * Compute the source-key for an artifact. Mirrors POC sourceKeyFor:
 * prefer frontmatter[keyField], else basename sans .md extension.
 * Coerces non-string scalars (Date, number) to string for comparison.
 */
export declare function sourceKeyFor(artifact: ScannedArtifact, keyField: string): string;
//# sourceMappingURL=artifact-pool-helpers.d.ts.map