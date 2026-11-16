import { InstallPlanner } from "./install-planner.js";
import { detectConflicts } from "./conflict-detector.js";
import { applyPolicy } from "./install-policy.js";
/**
 * Reusable package install pipeline. Composes resolve -> plan -> detect -> policy -> dedup -> apply -> verify.
 * Used by both the packages route and the bootstrap orchestrator.
 */
export class PackageInstallService {
    db;
    packageRepo;
    installEngine;
    installVerifier;
    constructor(deps) {
        this.db = deps.packageRepo.db;
        if (deps.installRepo.db !== this.db)
            throw new Error("PackageInstallService: installRepo must share the same db handle");
        this.packageRepo = deps.packageRepo;
        this.installEngine = deps.installEngine;
        this.installVerifier = deps.installVerifier;
    }
    /**
     * Run the full install pipeline for a single resolved package.
     */
    install(opts) {
        const { resolved, targetRoot, runtime, roleName, allowMerge, bootstrapId, fsOps } = opts;
        // Plan + detect conflicts
        let plan, refined;
        try {
            const planner = new InstallPlanner(fsOps);
            plan = planner.plan(resolved, targetRoot, runtime, { roleName });
            refined = detectConflicts(plan, fsOps);
        }
        catch (err) {
            return { ok: false, code: "apply_error", message: err.message };
        }
        // Check for content-level conflicts
        if (refined.conflicts.length > 0) {
            return { ok: false, code: "conflict_blocked", message: `${refined.conflicts.length} unresolved conflicts` };
        }
        // Apply policy
        const policyResult = applyPolicy(refined, { allowMerge: allowMerge ?? false });
        if (policyResult.approved.length === 0) {
            return { ok: false, code: "policy_rejected", message: "No entries approved by policy" };
        }
        // Dedup package record
        const existing = this.packageRepo.findByNameVersion(resolved.manifest.name, resolved.manifest.version);
        if (existing && existing.manifestHash !== resolved.manifestHash) {
            return { ok: false, code: "manifest_hash_mismatch", message: `Package already registered with different content` };
        }
        const pkg = existing ?? this.packageRepo.createPackage({
            name: resolved.manifest.name,
            version: resolved.manifest.version,
            sourceKind: resolved.sourceKind,
            sourceRef: resolved.sourceRef,
            manifestHash: resolved.manifestHash,
            summary: resolved.manifest.summary,
        });
        // Apply
        let result;
        try {
            result = this.installEngine.apply(policyResult, refined, pkg.id, targetRoot, bootstrapId);
        }
        catch (err) {
            return { ok: false, code: "apply_error", message: err.message };
        }
        // Verify
        const verification = this.installVerifier.verify(result.installId);
        if (!verification.passed) {
            return { ok: false, code: "verification_failed", message: "Post-apply verification failed" };
        }
        return {
            ok: true,
            installId: result.installId,
            packageId: pkg.id,
            applied: result.applied.length,
            deferred: result.deferred.length,
        };
    }
}
//# sourceMappingURL=package-install-service.js.map