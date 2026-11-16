import { type LegacyBundleManifest as BundleManifest, type BundleProvenance, type BundleCompatibility } from "./bundle-types.js";
export interface AssemblerFsOps {
    readFile: (path: string) => string;
    exists: (path: string) => boolean;
    mkdirp: (path: string) => void;
    writeFile: (path: string, content: string) => void;
    copyDir: (src: string, dest: string) => void;
}
export interface PackageInput {
    name: string;
    version: string;
    sourcePath: string;
    originalSource: string;
    manifestHash: string;
}
export interface AssembleOptions {
    specPath: string;
    packages: PackageInput[];
    outputDir: string;
    bundleName: string;
    bundleVersion: string;
    /**
     * Optional Item-1 provenance input. Caller fills the fields it knows
     * (sourceHost, authorSession, daemonVersion, cliVersion, sourceRigId,
     * sourceRigName, notes). The assembler mirrors root createdAt into
     * provenance.createdAt unless caller pre-set it (caller value wins
     * for test determinism). Missing block = no provenance recorded
     * (backward compat).
     */
    provenance?: BundleProvenance;
    /**
     * Optional Item-2 compatibility input. Caller declares minimum
     * daemon + CLI versions and optional schema_version reaffirmation.
     * Missing block = no compatibility recorded (backward compat); the
     * install-time version check at /api/bundles/install (Checkpoint 3.3)
     * is a no-op for bundles without compatibility.
     */
    compatibility?: BundleCompatibility;
}
/**
 * Assembles a bundle staging directory with canonical layout.
 * Generates bundle.yaml without integrity (P7-T02 adds that).
 */
export declare class LegacyBundleAssembler {
    private fs;
    constructor(deps: {
        fsOps: AssemblerFsOps;
    });
    assemble(opts: AssembleOptions): BundleManifest;
}
//# sourceMappingURL=bundle-assembler.d.ts.map