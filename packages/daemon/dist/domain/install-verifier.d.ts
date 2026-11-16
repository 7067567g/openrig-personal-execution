import type { InstallRepository } from "./install-repository.js";
import type { PackageRepository } from "./package-repository.js";
export interface Check {
    name: string;
    passed: boolean;
    expected?: string;
    actual?: string;
}
export interface EntryVerification {
    journalId: string;
    targetPath: string;
    checks: Check[];
}
export interface VerificationResult {
    passed: boolean;
    installId: string;
    entries: EntryVerification[];
    statusCheck: Check;
}
export interface VerifierFsOps {
    readFile: (filePath: string) => string;
    exists: (filePath: string) => boolean;
}
export declare class InstallVerifier {
    private installRepo;
    private packageRepo;
    private fs;
    constructor(installRepo: InstallRepository, packageRepo: PackageRepository, fs: VerifierFsOps);
    verify(installId: string): VerificationResult;
}
//# sourceMappingURL=install-verifier.d.ts.map