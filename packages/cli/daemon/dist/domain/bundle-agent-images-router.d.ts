/**
 * Bundle agent_images router (Item 6 / slice-05 Checkpoint 7.3g step 2).
 *
 * Pure function. Copies agent-image directories declared in a bundle
 * manifest's agent_images[] block from the bundle's extracted tree to the
 * operator agent-images library. No daemon dependencies — fully
 * unit-testable via FsOps injection.
 *
 * Per PRD §Item 6 line 197: agent_images entries are paths to the
 * agent-image DIRECTORY (not manifest paths — distinct shape from
 * context_packs per the e7a0b253 PRD-coherent repair). The router copies
 * the declared directory to <targetAgentImagesDir>/<basename(sourceAbs)>/
 * — the operator-host canonical layout per agent-image-types.ts:9-10.
 *
 * Consumer contract (agent-image-library-service.ts:77-95): the consumer
 * walks roots whose immediate children are image DIRS, requires each
 * image dir to be a directory + contain a manifest.yaml FILE. The router
 * enforces these consumer-visibility invariants at copy time so
 * routedCount stays truthful at the consumer-visible boundary.
 *
 * All four banked router-level catches from the context_packs cycle
 * (d491eca9 + 3cd581e3 + 16ebb8af + a0e7e0e1) apply identically and are
 * built in from the first commit:
 *   1. source path containment (mirrors all sibling routers)
 *   2. sourceAbs exists + isDirectory (declared path IS the image dir)
 *   3. manifest.yaml inside exists AS A FILE (consumer requires
 *      readable manifest.yaml; rejects manifest-missing AND manifest-
 *      is-a-directory cases — file-vs-dir discrimination axis)
 *   4. basename(sourceAbs) collision detection (first wins, second
 *      flagged status=conflict)
 *
 * /install handler integration lands at Checkpoint 7.3g step 3 with a
 * real consumer-scan() proof against the routed dir (mirror of the
 * cb0bf7b9 context_packs ContextPackLibraryService.scan reachability
 * proof).
 */
/** Filesystem injection point — real impl wraps node:fs. Tests substitute in-memory. */
export interface AgentImagesRouterFsOps {
    exists: (path: string) => boolean;
    isDirectory: (path: string) => boolean;
    mkdirp: (path: string) => void;
    copyDir: (src: string, dest: string) => void;
}
/** Inputs to routeAgentImages. */
export interface RouteAgentImagesInput {
    /** Absolute path to the bundle's extracted root (tmp dir from unpack). */
    bundleRoot: string;
    /** Relative paths to agent-image DIRECTORIES declared in the bundle
     *  manifest's agent_images[] block (per PRD §Item 6 line 197). */
    declaredAgentImages: string[];
    /** Absolute path to the operator agent-images library (per
     *  agent-image-types.ts:9-10: typically `<openrigHome>/agent-images/`
     *  or workspace-local `.openrig/agent-images/`). Caller resolves. */
    targetAgentImagesDir: string;
}
/** One routed agent_image (or one rejection). */
export interface RoutedAgentImageRecord {
    /** Declared path from manifest.agent_images[]. */
    declaredPath: string;
    /** "routed" = image dir copied successfully and consumer-visible.
     * "missing" = declared image dir not in bundle (honest skip).
     * "unsafe" = source escapes bundleRoot OR target escapes
     * targetAgentImagesDir (structurally impossible given basename, kept
     * defensive).
     * "not_directory" = declared path exists but is not a directory.
     * "not_manifest" = image dir exists but manifest.yaml inside is
     * absent OR is itself a directory — consumer requires a readable
     * manifest.yaml file at the image dir root.
     * "conflict" = basename collides with an earlier routed image; first
     * wins, second flagged so routedCount stays truthful at the consumer-
     * visible boundary (banked 16ebb8af lesson). */
    status: "routed" | "missing" | "unsafe" | "not_directory" | "not_manifest" | "conflict";
    /** Where the image landed in the target library (absolute image dir
     *  path), if routed. */
    installedAt?: string;
    /** Human-readable detail (3-part error shape input for caller). */
    detail?: string;
}
/** Aggregate routing result. */
export interface RouteAgentImagesResult {
    records: RoutedAgentImageRecord[];
    routedCount: number;
    rejectedCount: number;
}
/**
 * Route each declared agent_image from the bundle tree to the operator
 * agent-images library. Per-entry safety: SOURCE containment under
 * bundleRoot + TARGET containment under targetAgentImagesDir. Consumer-
 * visibility invariants (declared dir IS a directory + manifest.yaml
 * inside exists AS A FILE) enforced BEFORE write so routedCount stays
 * truthful at the consumer-visible boundary. Caller writes the install
 * audit record using the records returned here.
 */
export declare function routeAgentImages(input: RouteAgentImagesInput, fs: AgentImagesRouterFsOps): RouteAgentImagesResult;
//# sourceMappingURL=bundle-agent-images-router.d.ts.map