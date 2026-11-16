import type { LegacyBundleManifest as BundleManifest, BundleIntegrity } from "./bundle-types.js";
export interface IntegrityFsOps {
    readFile: (path: string) => string;
    readFileBuffer: (path: string) => Buffer;
    writeFile: (path: string, content: string) => void;
    exists: (path: string) => boolean;
    walkFiles: (dir: string) => string[];
}
export declare function isHarnessLoginPath(relativePath: string): boolean;
export declare function harnessLoginMessage(relativePath: string, included?: boolean): string;
export declare function isSensitivePath(relativePath: string, includedLoginFiles?: ReadonlySet<string>): boolean;
/**
 * Compute integrity hashes for all content files in a bundle directory.
 * Throws on sensitive paths. Excludes control files and OS junk.
 */
export declare function computeIntegrity(dir: string, fsOps: IntegrityFsOps, includedLoginFiles?: string[]): BundleIntegrity;
/**
 * Write integrity section into bundle.yaml, then write bundle.yaml.sha256 digest.
 */
export declare function writeIntegrity(dir: string, integrity: BundleIntegrity, fsOps: IntegrityFsOps): void;
/** Verification result */
export interface VerifyResult {
    passed: boolean;
    mismatches: string[];
    missing: string[];
    extra: string[];
    errors: string[];
    warnings?: string[];
}
/**
 * Verify bundle integrity. Checks manifest digest first, then per-file hashes.
 */
export declare function verifyIntegrity(dir: string, manifest: BundleManifest, fsOps: IntegrityFsOps): VerifyResult;
//# sourceMappingURL=bundle-integrity.d.ts.map