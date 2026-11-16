import type { SeatEnv } from "./seat-env.js";
import type Database from "better-sqlite3";
import type { BootstrapRepository } from "./bootstrap-repository.js";
import type { RuntimeVerifier } from "./runtime-verifier.js";
import type { RequirementsProbeRegistry } from "./requirements-probe.js";
import type { ExternalInstallPlanner } from "./external-install-planner.js";
import type { ExternalInstallExecutor } from "./external-install-executor.js";
import type { PackageInstallService } from "./package-install-service.js";
import type { RigInstantiator } from "./rigspec-instantiator.js";
import type { FsOps } from "./package-resolver.js";
import type { BootstrapStatus } from "./bootstrap-types.js";
import type { LegacyBundleSourceResolver as BundleSourceResolver } from "./bundle-source-resolver.js";
import { type PodBundleSourceResolver } from "./bundle-source-resolver.js";
import { type BundleContentRouting } from "./bundle-content-routing.js";
import { type BundleInstallContext } from "./bundle-install-context.js";
/** Bootstrap mode */
export type BootstrapMode = "plan" | "apply";
/** Bootstrap options */
export interface BootstrapOptions {
    mode: BootstrapMode;
    sourceRef: string;
    sourceKind?: string;
    cwdOverride?: string;
    /** One-off launch env from `rig up --env`; used for this launch only and not saved. */
    envOverride?: SeatEnv;
    autoApprove?: boolean;
    nonInterruptive?: boolean;
    approvedActionKeys?: string[];
    /** Pre-created run ID (route creates run for real-time started event) */
    runId?: string;
    /** Override install target root (required for bundle install apply) */
    targetRoot?: string;
}
/** Stage result */
export interface BootstrapStageResult {
    stage: string;
    status: "ok" | "blocked" | "skipped" | "failed";
    detail: unknown;
}
/** Full bootstrap result */
export interface BootstrapResult {
    runId: string;
    status: BootstrapStatus;
    stages: BootstrapStageResult[];
    rigId?: string;
    errors: string[];
    warnings: string[];
    /** Plan-mode action keys for reviewed approval */
    actionKeys?: string[];
    /** What a pod-aware bundle's pre-launch routing did, when it ran */
    bundleRouting?: BundleContentRouting;
    bundleInstall?: BundleInstallContext;
}
import type { PodRigInstantiator } from "./rigspec-instantiator.js";
interface BootstrapOrchestratorDeps {
    db: Database.Database;
    bootstrapRepo: BootstrapRepository;
    runtimeVerifier: RuntimeVerifier;
    probeRegistry: RequirementsProbeRegistry;
    installPlanner: ExternalInstallPlanner;
    installExecutor: ExternalInstallExecutor;
    packageInstallService: PackageInstallService;
    rigInstantiator: RigInstantiator;
    fsOps: FsOps;
    bundleSourceResolver: BundleSourceResolver | null;
    podInstantiator?: PodRigInstantiator;
    podBundleSourceResolver?: PodBundleSourceResolver;
    serviceOrchestrator?: import("./service-orchestrator.js").ServiceOrchestrator;
    rigRepo?: import("./rig-repository.js").RigRepository;
    /** Routes a bundle's declared contents; startup wires it to rescan the live context-pack library. */
    routeBundleContents?: (bundlePath: string) => Promise<BundleContentRouting>;
}
/**
 * Top-level bootstrap workflow. Composes all Phase 5 services into a staged pipeline.
 * Transactional by stage, not globally atomic.
 */
export declare class BootstrapOrchestrator {
    private deps;
    private activeLocks;
    /** Try to acquire the lock for a sourceRef. Returns false if already locked. */
    tryAcquire(sourceRef: string): boolean;
    /** Release the lock for a sourceRef. */
    release(sourceRef: string): void;
    constructor(deps: BootstrapOrchestratorDeps);
    /** Route a bundle's declared skills, plugins, workflow specs, context packs and agent images. Never throws. */
    routeBundleContents(bundlePath: string): Promise<BundleContentRouting>;
    bootstrap(opts: BootstrapOptions): Promise<BootstrapResult>;
    private executeStages;
    private handlePodAwareSpec;
    /**
     * Build a prelaunch hook for the service gate. Returns undefined if no services
     * are configured or no ServiceOrchestrator is available.
     */
    private buildServicePrelaunchHook;
    private resolveLegacyNodeCwds;
}
export {};
//# sourceMappingURL=bootstrap-orchestrator.d.ts.map