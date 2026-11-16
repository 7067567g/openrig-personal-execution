/**
 * Bundle plugins router (Item 6 / slice-05 Checkpoint 7.3c).
 *
 * Pure function. Copies plugin trees declared in a bundle manifest's
 * plugins[] block from the bundle's extracted tree to the operator plugins
 * library (per-id subdir). Mirrors the bundle-skills-router pattern: FsOps
 * injection; both-sides path containment (banked
 * feedback_pre_existing_trust_boundary_reuse_canonical_helper addendum:
 * contain BOTH source AND target when handling untrusted path input);
 * missing source surfaces as status=missing; unsafe paths rejected with
 * status=unsafe.
 *
 * Per orch-ratified HYBRID decision: v0 source.kind is local only (path
 * under the bundle's extracted tree). Other kinds (external operator-host
 * paths, remote fetch) reserved for future.
 *
 * /install handler integration lands at Checkpoint 7.3d.
 */
/** Filesystem injection point — real impl wraps node:fs. Tests substitute in-memory. */
export interface PluginsRouterFsOps {
    exists: (path: string) => boolean;
    isDirectory: (path: string) => boolean;
    mkdirp: (path: string) => void;
    copyDir: (src: string, dest: string) => void;
}
/** A plugin reference in the bundle manifest. Matches the daemon's BundlePluginReference shape. */
export interface PluginRoutingInput {
    id: string;
    source: {
        kind: "local";
        path: string;
    };
}
/** Inputs to routePlugins. */
export interface RoutePluginsInput {
    /** Absolute path to the bundle's extracted root (tmp dir from unpack). */
    bundleRoot: string;
    /** Plugin references declared in the manifest. */
    declaredPlugins: PluginRoutingInput[];
    /** Absolute path to the operator plugins library (default ~/.openrig/plugins). */
    targetPluginsDir: string;
}
/** One routed plugin (or one rejection). */
export interface RoutedPluginRecord {
    /** Plugin id from manifest.plugins[].id. */
    id: string;
    /** "routed" = directory copied; "missing" = source not in bundle; "unsafe"
     * = source or target escapes its bounding directory; "not_directory" =
     * source path is not a directory. */
    status: "routed" | "missing" | "unsafe" | "not_directory";
    /** Where the plugin landed in the target library (absolute path), if routed. */
    installedAt?: string;
    /** Human-readable detail. */
    detail?: string;
}
/** Aggregate routing result. */
export interface RoutePluginsResult {
    records: RoutedPluginRecord[];
    routedCount: number;
    rejectedCount: number;
}
/**
 * Route each declared plugin from the bundle tree to the operator plugins
 * library as <targetPluginsDir>/<id>/. Per-plugin safety: BOTH source path
 * (under bundleRoot) AND target path (under targetPluginsDir) are
 * containment-checked. Banked both-sides-of-trust-boundary lesson applied.
 */
export declare function routePlugins(input: RoutePluginsInput, fs: PluginsRouterFsOps): RoutePluginsResult;
//# sourceMappingURL=bundle-plugins-router.d.ts.map