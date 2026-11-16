/**
 * Bundle context_packs router (Item 6 / slice-05 Checkpoint 7.3f step 2).
 *
 * Pure function. Copies context-pack directories declared in a bundle
 * manifest's context_packs[] block from the bundle's extracted tree to
 * the operator context-packs library. No daemon dependencies — fully
 * unit-testable via FsOps injection.
 *
 * Per PRD §Item 6 line 196: context_packs entries are paths to a
 * context-pack's manifest.yaml file inside the bundle. The PACK is the
 * PARENT DIRECTORY of that manifest.yaml (per context-pack-types.ts:9-10
 * and context-pack-library-service.ts:50-77: a pack is a directory whose
 * immediate children include manifest.yaml + the referenced content
 * files). The router copies that parent dir to
 * <targetContextPacksDir>/<basename(parentDir)>/ — the operator-host
 * canonical layout the live consumer scans.
 *
 * Banked degenerate-input dogfood discipline (extended from the
 * workflow_specs basename-collision + non-YAML cycles): every router
 * commit explicitly probes the failure-class edges through the live
 * consumer's contract before claiming routedCount truthful. For
 * context_packs the consumer-invisibility classes are:
 *   - Declared path basename is NOT "manifest.yaml" → consumer never
 *     scans (it looks for manifest.yaml at the pack dir root). status=
 *     not_manifest.
 *   - Two declared paths whose parent-dir basename collide → second
 *     would silently overwrite the first; status=conflict; first wins.
 *   - Source pack dir not present in bundle → status=missing (honest skip).
 *   - Source path escapes bundleRoot → status=unsafe.
 *   - Lore-classed or structurally internal content → status=lore_refused
 *     or substance_refused, before copy.
 *
 * Both-sides containment (banked
 * feedback_pre_existing_trust_boundary_reuse_canonical_helper addendum):
 * source-side under bundleRoot, target-side under targetContextPacksDir
 * (target via basename so structurally safe; defensive check retained).
 *
 * /install handler integration lands at Checkpoint 7.3f step 3 with a
 * real consumer-scan() proof against the routed dir (mirror of the
 * workflow_specs scanWorkflowSpecFolder reachability proof at d81456dc).
 */
/** Filesystem injection point — real impl wraps node:fs. Tests substitute in-memory. */
export interface ContextPacksRouterFsOps {
    exists: (path: string) => boolean;
    isDirectory: (path: string) => boolean;
    readFile: (path: string) => string;
    listFiles: (dirPath: string) => string[];
    mkdirp: (path: string) => void;
    copyDir: (src: string, dest: string) => void;
}
/** Inputs to routeContextPacks. */
export interface RouteContextPacksInput {
    /** Absolute path to the bundle's extracted root (tmp dir from unpack). */
    bundleRoot: string;
    /** Relative paths to context-pack manifest.yaml files declared in the
     *  bundle manifest's context_packs[] block. */
    declaredContextPacks: string[];
    /** Absolute path to the operator context library (per
     *  context-pack-types.ts:9-10: typically `<context.root>`; the caller may
     *  also route to a workspace-local `.openrig/context-packs`). */
    targetContextPacksDir: string;
}
/** One routed context_pack (or one rejection). */
export interface RoutedContextPackRecord {
    /** Declared path from manifest.context_packs[]. */
    declaredPath: string;
    /** "routed" = pack dir copied successfully and consumer-visible.
     * "missing" = pack manifest source not in bundle (honest skip).
     * "unsafe" = source escapes bundleRoot OR target escapes
     * targetContextPacksDir (structurally impossible given basename, kept
     * defensive).
     * "not_manifest" = declared path basename is not "manifest.yaml" —
     * consumer (context-pack-library-service.scan) scans pack dirs for a
     * top-level manifest.yaml file; any other basename is invisible-by-
     * construction.
     * "not_directory" = parent of the declared manifest path is not a
     * directory in the bundle tree.
     * "conflict" = parent-dir basename collides with an earlier routed
     * pack; first wins, second flagged so routedCount stays truthful at
     * the consumer-visible boundary (banked 16ebb8af lesson).
     * "lore_refused" = the pack declares taxonomy: lore.
     * "substance_refused" = the pack contains structurally internal
     * content. Both refusal states happen before any copy.
     * "already_installed" = a pack of the same name is installed with every
     * one of the bundle's files byte-identical; nothing was written.
     * "kept_existing" = a different pack of the same name is installed (for
     * example a `rig context add --git` install at another revision); it was
     * left untouched. Routing never merges into an installed pack. */
    status: "routed" | "missing" | "unsafe" | "not_manifest" | "not_directory" | "conflict" | "lore_refused" | "substance_refused" | "already_installed" | "kept_existing";
    /** Where the pack landed in the target library (absolute pack dir
     *  path), if routed. */
    installedAt?: string;
    /** Human-readable detail (3-part error shape input for caller). */
    detail?: string;
}
/** Aggregate routing result. */
export interface RouteContextPacksResult {
    records: RoutedContextPackRecord[];
    routedCount: number;
    rejectedCount: number;
}
/**
 * Route each declared context_pack from the bundle tree to the operator
 * context-packs library. Per-entry safety: SOURCE containment under
 * bundleRoot + TARGET containment under targetContextPacksDir.
 * Degenerate inputs the consumer ignores (non-manifest.yaml basename;
 * parent-dir basename collisions) are caught BEFORE write so the
 * routedCount stays truthful at the consumer-visible boundary. Caller
 * writes the install audit record using the records returned here.
 */
export declare function routeContextPacks(input: RouteContextPacksInput, fs: ContextPacksRouterFsOps): RouteContextPacksResult;
//# sourceMappingURL=bundle-context-packs-router.d.ts.map