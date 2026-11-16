import type { BundleProjectReference } from "./bundle-types.js";
/** The folder a carried project occupies inside a bundle. */
export declare const BUNDLE_PROJECT_DIR = "project";
/** The id a project.yaml declares, read the way `rig context work-install` reads it. */
export declare function projectManifestId(manifest: unknown): string | null;
/**
 * Vendor a project folder (project.yaml plus the files beside it, such as its
 * SPEC.md) into a bundle being built, for `rig bundle create --project-dir`.
 * Every file must resolve inside the folder. Returns the manifest's `project`
 * reference.
 */
export declare function vendorProjectDir(projectDir: string, staging: string): BundleProjectReference;
//# sourceMappingURL=bundle-carried-project.d.ts.map