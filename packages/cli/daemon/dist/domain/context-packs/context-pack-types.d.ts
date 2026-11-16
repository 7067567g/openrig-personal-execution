export interface ContextPackManifestFile {
    /** Relative path within the pack directory. */
    path: string;
    /** Free-form operator-defined role (e.g., "prd", "proof-packet",
     *  "architecture-brief"); closed enum at v1+ if patterns emerge. */
    role: string;
    /** One-line description rendered in the review pane and bundle frame. */
    summary?: string;
}
export declare const ATOM_TAXONOMIES: readonly ["world", "lore", "skills", "mission"];
/** OPR.0.5.6.10 mini-req 2 — the classification teaching shared by every
 *  refusal surface (daemon parser, CLI install validator): the legal values
 *  and one sentence of meaning each (the coining-session definitions). */
export declare const TAXONOMY_TEACHING: string;
export declare const ATOM_REGIONS: readonly ["identity", "ontology", "terrain", "actors", "laws", "history", "state", "affordances"];
export declare const ATOM_SITUATIONS: readonly ["fresh", "handover", "post-compaction"];
export declare const ATOM_PURPOSES: readonly ["depth", "width"];
export declare const ATOM_RUNTIMES: readonly ["claude", "codex", "any"];
export declare const ATOM_PRIORITIES: readonly ["core", "recommended", "optional"];
export declare const CONTEXT_PROFILE_RUNTIMES: readonly ["claude", "codex"];
export declare const CONTEXT_PROFILE_SOURCES: readonly ["project", "mission", "seat", "slice"];
/** An install ATOM (OPR.0.5.3.5 mini-req 1): an ADDRESS plus composition
 *  metadata, never a new file — fresh/handover/post-compaction all compose
 *  addresses into the same bytes, so there is no second copy to drift
 *  (mini-req 5 by construction). Token counts are DERIVED at compose time,
 *  never stored here (volatility x consequence rule). */
export interface ContextPackAtom {
    /** Stable slug — the join key for order/requires/probes. */
    id: string;
    /** `file` or `file#H2-slug/H3-slug` (the Atom-1 grammar); the file must be
     *  one of the manifest's declared files, and a header path requires a
     *  markdown file. */
    address: string;
    taxonomy: (typeof ATOM_TAXONOMIES)[number];
    /** World-anatomy tags — enables compose-by-region (the measured
     *  post-compaction need was width: affordances + terrain). */
    regions?: Array<(typeof ATOM_REGIONS)[number]>;
    /** The composition algebra's selector; never empty. */
    situations: Array<(typeof ATOM_SITUATIONS)[number]>;
    purpose: (typeof ATOM_PURPOSES)[number];
    /** Mini-req 3: never assume identical compaction loss. Default "any". */
    runtime: (typeof ATOM_RUNTIMES)[number];
    /** Position within the base walk — absorption depends on sequence. */
    order: number;
    /** Dependency edges; a subset profile must close over them. Declared ids
     *  only, no self-reference, no cycles. */
    requires?: string[];
    /** What drops FIRST when a token budget binds (mini-req 9). */
    priority: (typeof ATOM_PRIORITIES)[number];
    /** Named-profile-only atoms do not join the legacy situation profile. This
     *  lets a coverage map point at the canonical source graph without making
     *  the map itself another default preload. */
    profileOnly?: boolean;
    /** Mini-req 2: acceptance is CHANGED BEHAVIOR — a natural prompt plus the
     *  expected observable behavior. Q3 bridge: the shape reconciles with the
     *  harness's EvalCase — optional compilable expectedPatterns (the
     *  deterministic door leg) and a 1-5 rubric (the judged leg); `expect`
     *  stays the required prose contract. Closed key set at ingest. */
    probe?: {
        prompt: string;
        expect: string;
        expectedPatterns?: string[];
        rubric?: string;
    };
}
/** One explicit delivery phase. Atom phases select bytes already owned by the
 * pack; context phases insert the configured project/mission/seat/task sources
 * without copying those authorities into the pack. */
export interface ContextPackProfilePhase {
    id: string;
    atoms?: string[];
    context?: Array<(typeof CONTEXT_PROFILE_SOURCES)[number]>;
}
/** A named, inspectable selection + sequence over one pack's atom graph. The
 * runtime is an applicability check, not a new content source. */
export interface ContextPackProfile {
    id: string;
    situations: Array<(typeof ATOM_SITUATIONS)[number]>;
    runtimes: Array<(typeof CONTEXT_PROFILE_RUNTIMES)[number]>;
    phases: ContextPackProfilePhase[];
}
export interface ContextPackManifest {
    name: string;
    version: string;
    purpose?: string;
    /** OPR.0.5.6.10 mini-req 1 — REQUIRED pack-level classification from the one
     *  shared enum. Classifies the pack as a whole; atom-level taxonomy remains
     *  authoritative for atoms and may differ per atom (mini-req 5). */
    taxonomy: (typeof ATOM_TAXONOMIES)[number];
    files: ContextPackManifestFile[];
    /** Operator-supplied estimate (used as a hint when no per-file
     *  estimate is available); the library service computes a derived
     *  `derivedEstimatedTokens` from actual file sizes for display. */
    estimatedTokens?: number;
    /** OPR.0.5.3.5 mini-req 1 — install atoms with composition metadata. */
    atoms?: ContextPackAtom[];
    /** Optional named install profiles. Omitted preserves the legacy
     * situation/runtime composition exactly. */
    profiles?: ContextPackProfile[];
}
export type ContextPackSourceType = "builtin" | "user_file" | "workspace";
/** Library-shaped record emitted by ContextPackLibraryService. */
export interface ContextPackEntry {
    /** Stable identifier for routes / UI navigation:
     *  `context-pack:<name>:<version>`. */
    id: string;
    kind: "context-pack";
    name: string;
    version: string;
    purpose: string | null;
    /** OPR.0.5.6.10 mini-req 4 — the pack classification, projected so the
     *  list surfaces it (human column + `--json` field). */
    taxonomy: (typeof ATOM_TAXONOMIES)[number];
    sourceType: ContextPackSourceType;
    /** Absolute path to the pack directory. */
    sourcePath: string;
    /** Path relative to the discovery root that found this pack. */
    relativePath: string;
    /** ISO timestamp of the most recent mtime under the pack dir
     *  (manifest.yaml or any included file — whichever is newer). */
    updatedAt: string;
    /** Operator-supplied estimate from the manifest, or null. */
    manifestEstimatedTokens: number | null;
    /** Daemon-derived estimate from actual file sizes (chars / 4
     *  rounded — matches the existing context-usage convention). */
    derivedEstimatedTokens: number;
    /** Per-file metadata projected from the manifest + on-disk reads. */
    files: ContextPackEntryFile[];
}
export interface ContextPackEntryFile {
    path: string;
    role: string;
    summary: string | null;
    /** Absolute path to the file on disk; null when manifest references
     *  a file that doesn't exist (the entry surfaces honestly with
     *  bytes=null instead of refusing to index). */
    absolutePath: string | null;
    /** File size in bytes; null when missing or unreadable. */
    bytes: number | null;
    /** Daemon-derived per-file token estimate (chars / 4 rounded). */
    estimatedTokens: number | null;
}
export declare class ContextPackError extends Error {
    readonly code: "manifest_missing" | "manifest_parse_error" | "manifest_invalid" | "pack_not_found" | "file_outside_pack" | "file_read_failed" | "unsafe_ref" | "missing_files" | "pack_exists" | "pack_ref_below_pack" | "unsafe_ref_namespace" | "pack_write_failed" | "store_unavailable" | "pack_not_removable";
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: "manifest_missing" | "manifest_parse_error" | "manifest_invalid" | "pack_not_found" | "file_outside_pack" | "file_read_failed" | "unsafe_ref" | "missing_files" | "pack_exists" | "pack_ref_below_pack" | "unsafe_ref_namespace" | "pack_write_failed" | "store_unavailable" | "pack_not_removable", message: string, details?: Record<string, unknown> | undefined);
}
//# sourceMappingURL=context-pack-types.d.ts.map