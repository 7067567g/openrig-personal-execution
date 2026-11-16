import type { InstallPlanEntry } from "./install-planner.js";
import type { PolicyResult } from "./install-policy.js";
import type { RefinedInstallPlan } from "./conflict-detector.js";
import { InstallRepository, type JournalEntry } from "./install-repository.js";
export interface EngineFsOps {
    readFile: (filePath: string) => string;
    writeFile: (filePath: string, content: string) => void;
    exists: (filePath: string) => boolean;
    mkdirp: (dirPath: string) => void;
    copyFile: (src: string, dest: string) => void;
    deleteFile: (filePath: string) => void;
}
export interface InstallResult {
    installId: string;
    applied: JournalEntry[];
    deferred: InstallPlanEntry[];
    conflicts: InstallPlanEntry[];
}
export interface RollbackResult {
    installId: string;
    restored: string[];
    deleted: string[];
}
export declare class InstallEngine {
    private installRepo;
    private fs;
    constructor(installRepo: InstallRepository, fs: EngineFsOps);
    apply(policyResult: PolicyResult, plan: RefinedInstallPlan, packageId: string, targetRoot: string, bootstrapId?: string): InstallResult;
    rollback(installId: string): RollbackResult;
    private rollbackEntries;
    private applyGuidanceMerge;
}
//# sourceMappingURL=install-engine.d.ts.map