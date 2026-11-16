import { type LegacyBundleManifest as BundleManifest } from "./bundle-types.js";
import type { ResolvedPackage, FsOps } from "./package-resolver.js";
/** Result of resolving a bundle for bootstrap consumption */
export interface BundleResolvedSource {
    specPath: string;
    resolvedPackages: ResolvedPackage[];
    /** Map from original ref (as it appears in rig spec package_refs) to resolved package */
    packageRefMap: Record<string, ResolvedPackage>;
    manifest: BundleManifest;
    tempDir: string;
}
/**
 * Resolves a .rigbundle archive into bootstrap-compatible sources.
 * Extracts, verifies, parses manifest, maps vendored packages.
 */
export declare class LegacyBundleSourceResolver {
    private fsOps;
    constructor(deps: {
        fsOps: FsOps;
    });
    /**
     * Resolve a bundle archive into bootstrap-compatible sources.
     * Caller must call cleanup(tempDir) after use.
     */
    resolve(bundlePath: string): Promise<BundleResolvedSource>;
    /** Remove the temp extraction directory. */
    cleanup(tempDir: string): void;
}
import { type PodBundleManifest } from "./bundle-types.js";
/** Result of resolving a pod-aware bundle */
export interface PodBundleResolvedSource {
    specPath: string;
    manifest: PodBundleManifest;
    tempDir: string;
}
/**
 * Resolves a pod-aware .rigbundle archive (schemaVersion 2).
 * Extracts, verifies manifest shape, returns paths for downstream resolution.
 */
export declare class PodBundleSourceResolver {
    resolve(bundlePath: string): Promise<PodBundleResolvedSource>;
    cleanup(tempDir: string): void;
}
/**
 * Copy an extracted (already verified) pod bundle into a stable target root so
 * the rig launched from it keeps a live spec dir, agent refs and `cwd: "."`
 * after the temp extraction is removed.
 *
 * Refuses — writing nothing — when any bundle file would land on a path in the
 * target that holds different content (or a directory). Identical files are
 * left as they are, so re-installing the same bundle into the same target works.
 * For an explicitly requested stopped-team replacement, preserve conflicting
 * paths in the instance before writing the offered bundle. Other files stay put.
 */
export declare function materializePodBundle(extractedDir: string, targetRoot: string, preserveConflicts?: boolean): {
    ok: true;
    backupPath?: string;
} | {
    ok: false;
    conflicts: string[];
};
//# sourceMappingURL=bundle-source-resolver.d.ts.map