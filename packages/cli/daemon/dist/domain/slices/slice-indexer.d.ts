import type Database from "better-sqlite3";
export type SliceStatus = "active" | "done" | "blocked" | "draft";
export interface SliceQitemRef {
    qitemId: string;
    state: string;
    sourceSession: string;
    destinationSession: string;
    tier: string | null;
    tsUpdated: string;
}
export interface SliceProofPacket {
    /** Directory name under the dogfood-evidence root. */
    dirName: string;
    /** Absolute path on disk. */
    absPath: string;
    /** Markdown file paths (relative to dirName). Latest-first by mtime. */
    markdownFiles: string[];
    /** Inline-renderable image paths (relative to dirName). */
    screenshots: string[];
    /** Video file paths (relative to dirName). Empty array if QA hasn't captured one yet. */
    videos: string[];
    /** Trace zip paths (relative to dirName). */
    traces: string[];
    /** mtime of the directory (ISO string). */
    mtime: string;
}
/** V0.3.1 slice 13 walk-item 7 — `workflow_spec: <name>@<version>`
 *  frontmatter declaration. When set, the Topology tab projects a
 *  spec graph from this declaration via WorkflowSpecCache.getByName-
 *  Version + projectSpecGraph, even when no live workflow_instance
 *  is bound. Null when the field is absent or malformed. */
export interface WorkflowSpecRef {
    name: string;
    version: string;
}
export interface SliceRecord {
    /** Folder name (canonical id). */
    name: string;
    /** Mission folder id when discovered under missions/<mission>/slices/<slice>. */
    missionId: string | null;
    /** Absolute filesystem path of the slice folder. */
    slicePath: string;
    /** Display name from frontmatter or first H1; falls back to name. */
    displayName: string;
    /** Optional rail-item code (PL-005, PL-019, etc.) parsed from frontmatter. */
    railItem: string | null;
    /** Mapped status from frontmatter status field. */
    status: SliceStatus;
    /** Raw status string from frontmatter (for debugging). */
    rawStatus: string | null;
    /** Joined qitem ids from queue_items matched by frontmatter rail-item or slice-name body. */
    qitemIds: string[];
    /** Commit refs parsed from frontmatter (phase-X-shipped-commits, target-commit, etc.). */
    commitRefs: string[];
    /** Latest matching dogfood-evidence directory (or null). */
    proofPacket: SliceProofPacket | null;
    /** Max of slice folder mtimes + matched qitem ts_updated values. */
    lastActivityAt: string | null;
    /** Sources cited in frontmatter (e.g. PRDs, planner-briefs). */
    files: string[];
    /** Parsed `workflow_spec: <name>@<version>` frontmatter declaration; null when absent or malformed. */
    workflowSpec: WorkflowSpecRef | null;
}
export interface SliceListEntry {
    name: string;
    missionId: string | null;
    displayName: string;
    railItem: string | null;
    /** Mirrors SliceRecord.workflowSpec; null when absent or malformed. */
    workflowSpec: WorkflowSpecRef | null;
    status: SliceStatus;
    rawStatus: string | null;
    /** OPR.0.3.2.17 — frontmatter `description` / `summary` from the
     *  slice's primary doc (README/IMPLEMENTATION-PRD/PROGRESS). Used by
     *  the storytelling adapter as the ConceptCard.oneLiner for
     *  `rawStatus === "candidate"` slices. null when absent. */
    description: string | null;
    qitemCount: number;
    hasProofPacket: boolean;
    lastActivityAt: string | null;
    /** PL-007 — absolute filesystem path of the slice folder. UI resolves
     *  workspace kind by matching this against RigSpec.workspace.repos[].path
     *  / knowledgeRoot. Always populated by toListEntry. */
    slicePath: string;
}
export interface SliceIndexerOpts {
    projectId?: string;
    missionId?: string;
    /** Root directory containing slice folders. */
    slicesRoot: string;
    /** Additional compatible roots to scan after the primary root. */
    additionalSliceRoots?: string[];
    /** Root directory containing dogfood-evidence directories. */
    dogfoodEvidenceRoot: string | null;
    /** SQLite handle for read-only joins to queue_items + transitions + actions. */
    db: Database.Database;
    /** Cache TTL in milliseconds. Default 60_000 (60s) — re-walks on next request after expiry. */
    cacheTtlMs?: number;
}
export declare class SliceIndexer {
    readonly projectId?: string;
    readonly missionId?: string;
    readonly slicesRoot: string;
    readonly additionalSliceRoots: string[];
    readonly dogfoodEvidenceRoot: string | null;
    /** Workflows in Spec Library v0: exposed read-only so the slices
     *  route's `boundToWorkflow` lens filter can call
     *  `findSliceWorkflowBinding(db, qitemIds)` without re-injecting
     *  the db handle elsewhere. Internal callers continue to use it
     *  the same way; read-only consumer outside the class. */
    readonly db: Database.Database;
    private readonly cacheTtlMs;
    private listingCache;
    private detailCache;
    private membershipIndex;
    private idAliases;
    private batchDepth;
    private compositionBasis;
    private missionStatusCache;
    constructor(opts: SliceIndexerOpts);
    /** Returns true when any configured slice root exists on disk. */
    isReady(): boolean;
    /** qitem-ccf87c0d corrective — the explicit COMPOSITE-OPERATION scope: a
     *  caller performing list()-plus-per-slice-get() as ONE user-visible
     *  operation (the slices route's boundToWorkflow lens, ReviewGatherer.
     *  composeMission) wraps it here so every inner list/get shares ONE
     *  membership batch instead of building one per uncached get (the 2+2N
     *  regression). Contract, pinned by test:
     *   - the OUTERMOST open never reuses a prior operation's batch (drops
     *     any existing one); the index is LAZY, so the first membership
     *     access inside the scope builds from then-current queue state —
     *     request-boundary freshness, no snapshot claim;
     *   - nested/reentrant scopes share the outermost batch;
     *   - the outermost exit ALWAYS clears (finally — exception-safe), so
     *     separate operations never share a generation;
     *   - standalone list()/get() outside any scope keep their own
     *     one-operation batch semantics unchanged (their clears are
     *     conditional on depth === 0).
     *  Synchronous by design — matches the synchronous list/get call graph. */
    withMembershipBatch<T>(fn: () => T): T;
    /** Drops both caches. Used by tests + by a future explicit-refresh route. */
    invalidate(): void;
    /** VM-005 B1 (the narrow C-vii exception; arch ruling b8d91aee…) — the
     *  READ-AFTER-WRITE seam: POST /:missionId/complete writes the mission
     *  README status, and the sidecar's 60s TTL would otherwise keep serving
     *  the pre-write word to /api/slices while /api/missions/:id reads the
     *  new word from disk. This drops the WHOLE missionStatusCache blob and
     *  nothing else (listing/detail caches untouched — drop-the-blob, never
     *  full-flush: zero coherence gain and a 60s registry churn were the
     *  ruling's reasons to reject the alternatives). The sole write path
     *  calls it post-success; the next read rebuilds from disk (README =
     *  SSOT). Out-of-band file writes remain the TTL regime by design. */
    invalidateMissionStatusCache(): void;
    /** VM-005 (release-0.4.7) — the authored mission-status sidecar for the
     *  slices list payload: one mission-README frontmatter read per indexed
     *  mission, inside the same 60s cache discipline as the listing. Keys are
     *  missions with at least one INDEXED slice (zero-slice missions have no
     *  indexed slices and never appear here — the tree's discovery walk owns
     *  that population). Read semantics are LOCKSTEP with
     *  routes/missions.ts readMissionStatus (README.md only, raw string, no
     *  enum validation, non-empty-or-null) — pinned by test. */
    missionAuthoredStatuses(): Record<string, {
        authoredStatus: string | null;
    }>;
    /** Lockstep twin of routes/missions.ts readMissionStatus (see the sidecar
     *  doc above; the lockstep test pins both reads agree on the same bytes). */
    private readMissionAuthoredStatus;
    list(): SliceListEntry[];
    get(name: string): SliceRecord | null;
    private reconcileComposition;
    /** The `slice:` tag values that name this slice: its directory name and, when
     *  its node file declares one that no other slice shares, its frontmatter id. */
    sliceTagKeys(name: string): string[];
    private readSliceLocations;
    /** Every slice location under the roots, whatever mission this indexer is scoped to.
     *  Directory names are deduplicated (first wins) unless `physical` asks for every folder. */
    private walkSliceLocations;
    private sliceIdAliases;
    /** The `id:` the slice's node file declares, read the way the execution view reads it. */
    private readSliceId;
    private findSliceLocation;
    private isDirectory;
    private sliceRoots;
    private toListEntry;
    private buildRecord;
    private readPrimaryFrontmatter;
    private extractDisplayName;
    private extractRailItem;
    private extractExplicitRailItem;
    private extractCommitRefs;
    private mapStatus;
    private matchQitems;
    /** qitem-ccf87c0d — build (or reuse) the per-generation membership index.
     *  TWO queue_items scans per generation, replacing O(slices) per-slice
     *  scans.
     *
     *  SCHEMA IS INSPECTED UP FRONT (qitem-18110994), never inferred from a
     *  swallowed error:
     *   - queue_items absent -> a structurally EMPTY index that is still
     *     PUBLISHED with its location metadata (knownSlices/terms), so get/list
     *     keep their semantics and no rebuild loop occurs;
     *   - tags column absent -> the typed scan is SKIPPED and Scan 2 uses the
     *     body-only query shape;
     *   - any PRAGMA / typed / fallback EXECUTION failure PROPAGATES to the
     *     caller and NOTHING is published (buckets accumulate locally and are
     *     published only on full success), so an interrupted build can never be
     *     cached as a plausible-but-incomplete answer.
     *
     *   Scan 1 (typed): `tags LIKE '%slice:%'` prefilter, ORDER BY ts_created
     *     DESC, qitem_id DESC (P2 determinism preserved), parseScopeTags as the
     *     authoritative row-level confirm; a row credits EVERY slice it tags;
     *     cap after 500 CONFIRMED per slice (never a pre-confirmation LIMIT —
     *     the B2/VM-004 rule). Global: every location, regardless of `served`.
     *   Scan 2 (fallback): one streamed pass over (body, tags) evaluated
     *     against the term universe of the SERVED zero-typed locations — all of
     *     them for list() and any open withMembershipBatch scope, exactly one
     *     for a standalone uncached get(). A combined regex is a PREFILTER
     *     only; every term is then confirmed per row so overlapping terms all
     *     credit (no consuming-alternation loss). Terms use SQL-LIKE-equivalent
     *     matching (asciiFold + %/_ translation); bucket order is row (rowid)
     *     order — the same order the un-ORDERed per-term `LIMIT 500` queries
     *     returned; cap 500 per term.
     *
     *  `served` (qitem-18110994 item 1) is the EXPLICIT scope of the current
     *  public operation — the slice names actually being answered, or null for
     *  "all known locations" — threaded through the call chain (get/list ->
     *  buildRecord/toListEntry -> matchQitems -> here), never ambient state. It
     *  narrows FRONTMATTER READS ONLY: locations, knownSlices, the typed scan
     *  and the all-location typedMissions verdict are established FIRST, so the
     *  cross-slice modern/legacy rule stays byte-identical (R5 differential). */
    private ensureMembershipIndex;
    private findProofPacket;
    private scanProofPacket;
    private computeLastActivity;
    private listSliceFiles;
}
export declare function parseFrontmatter(content: string): Record<string, unknown>;
/** V0.3.1 slice 13 walk-item 7 — parse `workflow_spec: <name>@<version>`
 *  frontmatter into a structured ref. Returns null when the value is
 *  missing, non-string, or doesn't match the `<name>@<version>` shape.
 *  Exported so the missions route can reuse the same parser on the
 *  mission README's frontmatter. */
/**
 * OPR.0.3.2.17 — extract a short description from slice frontmatter.
 * Tries `description` first, then `summary`. Returns null when both
 * are absent or non-string. Whitespace trimmed; empty strings become
 * null so the adapter's graceful-empty fallback fires.
 */
export declare function extractDescription(frontmatter: Record<string, unknown>): string | null;
export declare function parseWorkflowSpecRef(raw: unknown): WorkflowSpecRef | null;
//# sourceMappingURL=slice-indexer.d.ts.map