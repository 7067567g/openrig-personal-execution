import { type AgentResolverFsOps } from "./agent-resolver.js";
import { type PodBundleManifest, type BundleProvenance, type BundleCompatibility } from "./bundle-types.js";
export interface PodAssemblerFsOps extends AgentResolverFsOps {
    /** Raw bytes, for files the bundle copies verbatim (agent packages, culture, docs, startup files). */
    readFileBuffer(path: string): Uint8Array;
    realpath(path: string): string;
    mkdirp(path: string): void;
    /** Source permission bits, used to preserve executable bundle assets. */
    fileMode?(path: string): number;
    writeFile(path: string, content: string | Uint8Array, mode?: number): void;
    copyDir(src: string, dest: string): void;
    listFiles(dirPath: string, onReadError?: (path: string, error: unknown) => boolean): string[];
}
export interface PodAssembleOptions {
    rigRoot: string;
    rigSpecPath: string;
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
     * Missing block = no compatibility recorded (backward compat).
     */
    compatibility?: BundleCompatibility;
}
export interface PodAssembleResult {
    manifest: PodBundleManifest;
    collectedFiles: string[];
    warnings?: string[];
}
/**
 * Pod-aware bundle assembler. Walks embedded pod members' agent_ref to
 * collect AgentSpecs and their resources/imports. Produces a self-contained
 * bundle with rewritten refs.
 */
export declare class PodBundleAssembler {
    private fs;
    constructor(deps: {
        fsOps: PodAssemblerFsOps;
    });
    /**
     * Assemble a pod-aware bundle from a rig spec.
     * @param opts - assembly options
     * @returns manifest and list of collected files
     */
    assemble(opts: PodAssembleOptions): PodAssembleResult;
    private collectRigFile;
    private collectStartupFiles;
    private vendorDirectory;
    private findOriginalImportRef;
    private rewriteAgentYamlImportRefs;
    private rewriteRigSpecRefs;
}
//# sourceMappingURL=pod-bundle-assembler.d.ts.map