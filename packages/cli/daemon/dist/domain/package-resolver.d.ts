import { type PackageManifest } from "./package-manifest.js";
export interface ResolvedPackage {
    sourceKind: "local_path";
    sourceRef: string;
    manifest: PackageManifest;
    manifestHash: string;
    rawManifestYaml: string;
}
export interface FsOps {
    readFile: (filePath: string) => string;
    exists: (filePath: string) => boolean;
    listFiles?: (dirPath: string) => string[];
}
export declare class PackageResolver {
    private fs;
    constructor(fs: FsOps);
    resolve(sourceRef: string, cwd?: string): ResolvedPackage;
}
//# sourceMappingURL=package-resolver.d.ts.map