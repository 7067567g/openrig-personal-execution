import type { PackageRepository } from "./package-repository.js";
import type { InstallRepository } from "./install-repository.js";
import type { InstallEngine } from "./install-engine.js";
import type { InstallVerifier } from "./install-verifier.js";
import type { ResolvedPackage, FsOps } from "./package-resolver.js";
export type PackageInstallOutcome = {
    ok: true;
    installId: string;
    packageId: string;
    applied: number;
    deferred: number;
} | {
    ok: false;
    code: "conflict_blocked";
    message: string;
} | {
    ok: false;
    code: "policy_rejected";
    message: string;
} | {
    ok: false;
    code: "manifest_hash_mismatch";
    message: string;
} | {
    ok: false;
    code: "apply_error";
    message: string;
} | {
    ok: false;
    code: "verification_failed";
    message: string;
};
interface PackageInstallOpts {
    resolved: ResolvedPackage;
    targetRoot: string;
    runtime: "claude-code" | "codex";
    roleName?: string;
    allowMerge?: boolean;
    bootstrapId?: string;
    fsOps: FsOps;
}
interface PackageInstallServiceDeps {
    packageRepo: PackageRepository;
    installRepo: InstallRepository;
    installEngine: InstallEngine;
    installVerifier: InstallVerifier;
}
/**
 * Reusable package install pipeline. Composes resolve -> plan -> detect -> policy -> dedup -> apply -> verify.
 * Used by both the packages route and the bootstrap orchestrator.
 */
export declare class PackageInstallService {
    readonly db: import("better-sqlite3").Database;
    private packageRepo;
    private installEngine;
    private installVerifier;
    constructor(deps: PackageInstallServiceDeps);
    /**
     * Run the full install pipeline for a single resolved package.
     */
    install(opts: PackageInstallOpts): PackageInstallOutcome;
}
export {};
//# sourceMappingURL=package-install-service.d.ts.map