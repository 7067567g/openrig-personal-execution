import type { HealthDiagnosisService } from "./domain/health-diagnosis.js";
import type { HealthPolicyStore } from "./domain/health-policy.js";
import type { HealthCheckpointSource } from "./domain/health-checkpoints.js";
import { Hono } from "hono";
import type { RigRepository } from "./domain/rig-repository.js";
import type { SessionRegistry } from "./domain/session-registry.js";
import type { DaemonLifecycleStore } from "./domain/daemon-lifecycle-store.js";
import type { EventBus } from "./domain/event-bus.js";
import type { NodeLauncher } from "./domain/node-launcher.js";
import type { TmuxOptionDefaultsApplier } from "./domain/tmux-option-defaults.js";
import type { TmuxAdapter } from "./adapters/tmux.js";
import type { CmuxAdapter } from "./adapters/cmux.js";
import type { SnapshotCapture } from "./domain/snapshot-capture.js";
import type { SnapshotRepository } from "./domain/snapshot-repository.js";
import type { RestoreOrchestrator } from "./domain/restore-orchestrator.js";
import type { RigSpecExporter } from "./domain/rigspec-exporter.js";
import type { RigSpecPreflight } from "./domain/rigspec-preflight.js";
import type { RigInstantiator, PodRigInstantiator } from "./domain/rigspec-instantiator.js";
import type { PodBundleSourceResolver } from "./domain/bundle-source-resolver.js";
import type { PackageRepository } from "./domain/package-repository.js";
import type { InstallRepository } from "./domain/install-repository.js";
import type { InstallEngine } from "./domain/install-engine.js";
import type { InstallVerifier } from "./domain/install-verifier.js";
import type { BootstrapOrchestrator } from "./domain/bootstrap-orchestrator.js";
import type { BootstrapRepository } from "./domain/bootstrap-repository.js";
import type { DiscoveryCoordinator } from "./domain/discovery-coordinator.js";
import type { DiscoveryRepository } from "./domain/discovery-repository.js";
import type { ClaimService } from "./domain/claim-service.js";
import type { SelfAttachService } from "./domain/self-attach-service.js";
import type { PsProjectionService } from "./domain/ps-projection.js";
import type { UpCommandRouter } from "./domain/up-command-router.js";
import type { RigTeardownOrchestrator } from "./domain/rig-teardown.js";
import type { TranscriptStore } from "./domain/transcript-store.js";
import type { SessionTransport } from "./domain/session-transport.js";
import type { AgentActivityStore } from "./domain/agent-activity-store.js";
import type { ClaudeCompactionEnforcer } from "./domain/claude-compaction-enforcer.js";
import type { AskService } from "./domain/ask-service.js";
import type { WakeResolveService } from "./domain/wake-resolve-service.js";
import type { PluginDiscoveryService } from "./domain/plugin-discovery-service.js";
import type { SkillLibraryDiscoveryService } from "./domain/skill-library-discovery.js";
import type { SpecReviewService } from "./domain/spec-review-service.js";
import type { SpecLibraryService } from "./domain/spec-library-service.js";
import type { ChatRepository } from "./domain/chat-repository.js";
import type { ProviderService } from "./domain/provider/provider-service.js";
import type { WhoamiService } from "./domain/whoami-service.js";
import { type PermissionDriftReader } from "./domain/permission-drift-observer.js";
import type { StreamStore } from "./domain/stream-store.js";
import { type SlowOperationInstrumentation } from "./domain/slow-op-recorder.js";
import type { QueueRepository } from "./domain/queue-repository.js";
import type { InboxHandler } from "./domain/inbox-handler.js";
import type { OutboxHandler } from "./domain/outbox-handler.js";
import type { ProjectClassifier } from "./domain/project-classifier.js";
import type { ClassifierLeaseManager } from "./domain/classifier-lease-manager.js";
import type { ClassificationAttemptLedger } from "./domain/classification-attempts.js";
import type { ViewProjector } from "./domain/view-projector.js";
import type { WatchdogJobsRepository } from "./domain/watchdog-jobs-repository.js";
import type { WatchdogHistoryLog } from "./domain/watchdog-history-log.js";
import type { WatchdogPolicyEngine } from "./domain/watchdog-policy-engine.js";
import type { WatchdogScheduler } from "./domain/watchdog-scheduler.js";
import type { WorkflowRuntime } from "./domain/workflow-runtime.js";
import type { RigLifecycleService } from "./domain/rig-lifecycle-service.js";
import { type BrowserBoundaryOptions } from "./middleware/browser-boundary.js";
export interface AppDeps {
    proofSourceWatch?: import("./domain/proof/source-watch.js").ProofSourceWatch;
    /** S20 — effective bind plan for the health surface (absent = legacy body). */
    bindPlan?: {
        mode: "explicit" | "default";
        hosts: string[];
        tailscaleDetected: boolean;
        ignoredRoutingHost?: string;
    };
    rigRepo: RigRepository;
    sessionRegistry: SessionRegistry;
    /** P7 — daemon lifecycle record store + this boot's epoch (heartbeat + clean-shutdown). */
    daemonLifecycleStore: DaemonLifecycleStore;
    daemonBootEpoch: string;
    eventBus: EventBus;
    nodeLauncher: NodeLauncher;
    /** Seat-scoped explicit fresh launch composes the same startup owner as rig launch. */
    startupOrchestrator?: import("./domain/startup-orchestrator.js").StartupOrchestrator;
    tmuxAdapter: TmuxAdapter;
    /** OPR.0.4.6.02 S1 — the shared tmux option-defaults applier, exposed to
     *  the seat-handover route so a fresh successor gets launch-only defaults. */
    tmuxOptionDefaults?: TmuxOptionDefaultsApplier;
    cmuxAdapter: CmuxAdapter;
    snapshotCapture: SnapshotCapture;
    snapshotRepo: SnapshotRepository;
    /** Slice-04 OPR.0.5.0.4: the provider read-model/precheck/switch service. Routes 503 honestly if absent. */
    providerService?: ProviderService;
    restoreOrchestrator: RestoreOrchestrator;
    resumeMetadataRefresher?: import("./domain/resume-metadata-refresher.js").ResumeMetadataRefresher;
    rigSpecExporter: RigSpecExporter;
    rigSpecPreflight: RigSpecPreflight;
    rigInstantiator: RigInstantiator;
    packageRepo: PackageRepository;
    installRepo: InstallRepository;
    installEngine: InstallEngine;
    installVerifier: InstallVerifier;
    bootstrapOrchestrator: BootstrapOrchestrator;
    bootstrapRepo: BootstrapRepository;
    discoveryCoordinator: DiscoveryCoordinator;
    discoveryRepo: DiscoveryRepository;
    claimService: ClaimService;
    selfAttachService?: SelfAttachService;
    rigExpansionService?: import("./domain/rig-expansion-service.js").RigExpansionService;
    rigLifecycleService?: RigLifecycleService;
    /**
     * Slice 15 — Seat-activity service (terminal-active primitive). The
     * daemon owns one instance and wires it into PsProjectionService and
     * the per-node enrichment. Optional so existing test harnesses that
     * construct AppDeps directly don't need to provide one.
     */
    seatActivityService?: import("./domain/seat-activity-service.js").SeatActivityService;
    /** 5b82324b — the structural pane-activity cache; feeds attachAgentActivity so ACTIVITY is real. */
    seatStructuralActivityService?: import("./domain/seat-structural-activity-service.js").SeatStructuralActivityService;
    /** OPR.0.4.3.19 — periodic liveness identity reconciler (started post-bind). */
    seatIdentityReconciler?: import("./domain/seat-identity-reconciler.js").SeatIdentityReconciler;
    psProjectionService: PsProjectionService;
    /** OPR.0.7.0 P1c — the real enforcement snapshots `GET /api/ps/resources`
     *  projects per seat. Optional: absent yields honest `not_enforced` rows. */
    seatResources?: import("./domain/ps-resources.js").SeatResourcesSources;
    upRouter: UpCommandRouter;
    teardownOrchestrator: RigTeardownOrchestrator;
    podInstantiator: PodRigInstantiator;
    podBundleSourceResolver: PodBundleSourceResolver | null;
    runtimeAdapters?: Record<string, import("./domain/runtime-adapter.js").RuntimeAdapter>;
    transcriptStore?: TranscriptStore;
    sessionTransport?: SessionTransport;
    askService?: AskService;
    wakeResolveService?: WakeResolveService;
    chatRepo?: ChatRepository;
    streamStore?: StreamStore;
    slowOpRecorder?: SlowOperationInstrumentation;
    requestPhaseObserver?: import("./domain/request-phase-observer.js").RequestPhaseObserver;
    queueRepo?: QueueRepository;
    /** S02 — the standing stuck sweep's observable heartbeat (ADDITIVE on healthz;
     *  absent = legacy body). Set by the index.ts scheduler when the loop starts. */
    stuckSweepStatus?: import("./domain/queue-stuck-sweep.js").StuckSweepStatus;
    /** S01 — the wake-or-escalate ladder's heartbeat + open-escalations count (ADDITIVE on
     *  healthz; absent = legacy body). Part of the operator rung's stated delivery floor. */
    wakeLadderStatus?: import("./domain/queue-wake-ladder.js").WakeLadderStatus;
    inboxHandler?: InboxHandler;
    outboxHandler?: OutboxHandler;
    shadowCapture?: import("./domain/shadow-capture.js").ShadowCapture;
    shadowCaptureError?: string;
    projectClassifier?: ProjectClassifier;
    classifierLeaseManager?: ClassifierLeaseManager;
    /** 0.6.0 S02 P1: durable classification attempt ledger. */
    classificationAttemptLedger?: ClassificationAttemptLedger;
    viewProjector?: ViewProjector;
    watchdogJobsRepo?: WatchdogJobsRepository;
    watchdogHistoryLog?: WatchdogHistoryLog;
    watchdogPolicyEngine?: WatchdogPolicyEngine;
    watchdogScheduler?: WatchdogScheduler;
    /** B8 / slice-07 A3 — the model-divergence monitor (effective-vs-pinned, four-channel proclaim). */
    modelDivergenceMonitor?: import("./domain/model-divergence/model-divergence-monitor.js").ModelDivergenceMonitor;
    /** S10 — the in-daemon gateway subsystem (amended M1 §3: in-process, no second deployable).
     *  Optional so test harnesses constructing AppDeps directly need not provide one; the health
     *  route reports honestly when absent. */
    gatewaySubsystem?: import("./domain/gateway/gateway-subsystem.js").GatewaySubsystem;
    periodicSnapshotScheduler?: import("./domain/periodic-snapshot-scheduler.js").PeriodicSnapshotScheduler;
    workflowRuntime?: WorkflowRuntime;
    /**
     * Absolute path to the daemon's bundled built-in workflow-specs
     * directory. Used by `GET /api/workflow/specs` to
     * compute the per-row `isBuiltIn` flag (source_path under this dir
     * → built-in; otherwise → operator-authored). Optional: when unset,
     * the route returns isBuiltIn=false for every spec (graceful — the
     * surface still works, just without the indicator).
     */
    workflowBuiltinSpecsDir?: string;
    /** Slice 11 (workflow-spec-folder-discovery) — workspace workflows
     *  folder absolute path (typically `<workspace.specs_root>/workflows`).
     *  When set, GET /api/specs/library opportunistically scans this dir
     *  on each list request and surfaces valid + diagnostic rows. Unset
     *  → no folder scan (cache-only behavior). */
    workflowsFolderDir?: string;
    /** Slice 11 — WorkflowSpecCache instance for the folder scanner to
     *  read-through valid YAML and writeDiagnostic for invalid YAML.
     *  Same singleton as workflowRuntime.specCache. */
    workflowSpecCache?: import("./domain/workflow-spec-cache.js").WorkflowSpecCache;
    missionControlReadLayer?: import("./domain/mission-control/mission-control-read-layer.js").MissionControlReadLayer;
    missionControlWriteContract?: import("./domain/mission-control/mission-control-write-contract.js").MissionControlWriteContract;
    missionControlActionLog?: import("./domain/mission-control/mission-control-action-log.js").MissionControlActionLog;
    missionControlFleetCliCapability?: import("./domain/mission-control/mission-control-fleet-cli-capability.js").MissionControlFleetCliCapability;
    sliceIndexer?: import("./domain/slices/slice-indexer.js").SliceIndexer;
    reviewGatherer?: import("./domain/review/gather.js").ReviewGatherer;
    terminalService?: import("./domain/terminal/terminal-service.js").TerminalService;
    sliceDetailProjector?: import("./domain/slices/slice-detail-projector.js").SliceDetailProjector;
    /** User Settings v0 — daemon-side settings store (env > file > default). */
    settingsStore?: import("./domain/user-settings/settings-store.js").SettingsStore;
    /** Preview Terminal v0 (PL-018) — per-session rate limiter for /preview. */
    previewRateLimiter?: import("./domain/preview/preview-rate-limiter.js").PreviewRateLimiter<{
        content: string;
        lines: number;
        sessionName: string;
        capturedAt: string;
    }>;
    /** UI Enhancement Pack v0 — file allowlist + browser routes (item 3). */
    filesAllowlist?: import("./domain/files/path-safety.js").AllowlistRoot[];
    /** UI Enhancement Pack v0 — atomic write service (item 4). */
    fileWriteService?: import("./domain/files/file-write-service.js").FileWriteService | null;
    /** UI Enhancement Pack v0 — workspace PROGRESS.md indexer (item 1B). */
    progressIndexer?: import("./domain/progress/progress-indexer.js").ProgressIndexer;
    /** Operator Surface Reconciliation v0 — steering composer (item 1). */
    steeringComposer?: import("./domain/steering/steering-composer.js").SteeringComposer;
    missionControlAuditBrowse?: import("./domain/mission-control/audit-browse.js").MissionControlAuditBrowse;
    missionControlNotificationDispatcher?: import("./domain/mission-control/notification-dispatcher.js").MissionControlNotificationDispatcher;
    /**
     * PL-005 Phase B: bearer token (or null for loopback-only mode).
     * The mission-control routes use this to wire the
     * authBearerTokenMiddleware on write verbs.
     */
    missionControlBearerToken?: string | null;
    terminalBearerToken?: string | null;
    enableNodeWebSocket?: boolean;
    /** `ui.enabled`: serve the web UI pages and its terminal WebSocket. Off unless true; /api routes are unaffected. */
    webUiEnabled?: boolean;
    /** This machine's own extra names for the /api browser boundary (createDaemon wires the
     *  Tailscale MagicDNS self-name lookup). Absent: loopback, IP literals and OS names only. */
    selfNameDiscovery?: () => Promise<string[]>;
    /** Test hook: one call per /api browser-boundary decision. */
    browserBoundaryObserver?: BrowserBoundaryOptions["onDecision"];
    specReviewService?: SpecReviewService;
    specLibraryService?: SpecLibraryService;
    /**
     * Phase 3a slice 3.3 — plugin discovery service (filesystem-scan over
     * vendored + claude-cache + codex-cache; reads agent.yaml for used-by).
     * Read-only; no SQL. SC-29 #8 verbatim declaration in routes/plugins.ts.
     */
    pluginDiscoveryService?: PluginDiscoveryService;
    /**
     * Slice 28 Checkpoint C-3 — skill-library discovery service.
     * Consolidates workspace + openrig-managed skill sources; resolves
     * shared-skills via daemon install path (independent of operator's
     * OPENRIG_FILES_ALLOWLIST). Read-only; no SQL. SC-29 #11.
     */
    skillLibraryDiscoveryService?: SkillLibraryDiscoveryService;
    /** Workflows in Spec Library v0 — active workflow lens persistence. */
    activeLensStore?: import("./domain/active-lens-store.js").ActiveLensStore;
    /** Rig Context / Composable Context Injection v0 (PL-014) — context_packs library service. */
    contextPackLibrary?: import("./domain/context-packs/context-pack-library-service.js").ContextPackLibraryService;
    /** Fork Primitive + Starter Agent Images v0 (PL-016) — agent_images library service. */
    agentImageLibrary?: import("./domain/agent-images/agent-image-library-service.js").AgentImageLibraryService;
    /** Fork Primitive + Starter Agent Images v0 (PL-016) — snapshot capturer. */
    snapshotCapturer?: import("./domain/agent-images/snapshot-capturer.js").SnapshotCapturer;
    /** PL-016 evidence-guard spec-roots (lazy supplier — recomputed
     *  per scan so newly-installed specs get picked up). */
    agentImageSpecRoots?: () => readonly string[];
    whoamiService?: WhoamiService;
    /** W3 single-seat, read-only runtime-policy observer. */
    permissionDriftObserver?: PermissionDriftReader;
    contextUsageStore?: import("./domain/context-usage-store.js").ContextUsageStore;
    /** 0.5.10 S04 — one on-demand, read-only health projection shared by consumers. */
    healthProjection?: import("./domain/health-detectors.js").HealthProjectionService;
    healthDiagnosis?: HealthDiagnosisService;
    healthPolicy?: HealthPolicyStore;
    healthCheckpoints?: HealthCheckpointSource;
    contextMonitor?: {
        pollOnce(): Promise<void>;
    };
    /**
     * OPR.0.4.3.14 — Claude compaction enforcer, exposed to routes for the manual
     * compaction trigger (POST /api/compaction/trigger). Constructed once in
     * startup.ts and shared with ContextMonitor (same instance, so manual +
     * auto share one back-half state machine — no second restore path).
     */
    compactionEnforcer?: ClaudeCompactionEnforcer;
    /**
     * GHOST-STAGE (e/Class-B) — the canonical OccupantInvalidator, constructed once in startup and
     * injected so SeatHandoverService.commit()'s re-key call actually FIRES (dev-driver's fold added
     * the optional call but no concrete impl was wired — the invalidation was dead until this).
     */
    occupantInvalidator?: import("./domain/occupant-invalidator.js").OccupantInvalidator;
    nodeCmuxService?: import("./domain/node-cmux-service.js").NodeCmuxService;
    agentActivityStore?: AgentActivityStore;
    seatAttentionReconciler?: import("./domain/seat-attention-reconciler.js").SeatAttentionReconciler;
    activityHookToken?: string;
    serviceOrchestrator?: import("./domain/service-orchestrator.js").ServiceOrchestrator;
    composeAdapter?: import("./adapters/compose-services-adapter.js").ComposeServicesAdapter;
    uiDistDir?: string | null;
    /** V0.3.1 slice 05 kernel-rig-as-default — forward-fix #3 architectural.
     *  Tracker exposed via GET /api/kernel/status. Optional because tests
     *  + custom daemon compositions may construct AppDeps without auto-
     *  booting the kernel; the route returns 503 with a clear message
     *  when the tracker isn't wired. */
    kernelBootTracker?: import("./domain/kernel-boot-tracker.js").KernelBootTracker;
    /** Slice 09 (OPR.0.3.2.9) — operator-context-mode bindings store.
     *  Optional: when absent, the rig-policy routes return 503. */
    rigModeStore?: import("./domain/rig-mode/rig-mode-store.js").RigModeStore;
    operatingPosture?: import("./domain/rig-mode/operating-posture.js").OperatingPostureService;
    /**
     * OPR.0.4.3.21 — daemon event-loop health monitor. Optional: when absent
     * (e.g. direct-construction test harnesses) `/healthz` keeps its exact
     * `{ status: "ok" }` body. Constructed once per daemon in startup.ts and
     * surfaced on the enriched `/healthz` payload as the wedge-detection
     * evidence (loop lag / last-tick age / utilization / healthy verdict).
     */
    eventLoopMonitor?: import("./domain/event-loop-monitor.js").EventLoopMonitor;
    /**
     * OPR.0.4.3.21 — request-duration recorder for the expensive topology
     * routes. Optional (same rationale). When present, one timing middleware is
     * registered and the rolling last/max per route is surfaced on `/healthz`.
     */
    routeTimingRecorder?: import("./domain/route-timing-recorder.js").RouteTimingRecorder;
    /**
     * OPR.0.4.3.04 — OpenRig identity/activity env stamped onto a successor
     * tmux session created by the seat-handover full-cycle composer, mirroring
     * the env NodeLauncher uses at launch. Optional; the three core identity
     * vars are always derived internally by the composer.
     */
    sessionEnv?: Record<string, string | undefined>;
    /** Per-runtime launch env merged over sessionEnv (OMP's provider keys). */
    runtimeSessionEnv?: Record<string, Record<string, string | undefined>>;
}
export declare const WEB_UI_OFF_MESSAGE = "The OpenRig web UI is off. To turn it on, run `rig config set ui.enabled true`, then stop and start the daemon (`rig daemon stop`, `rig daemon start`).\n";
export declare function createApp(deps: AppDeps): Hono;
export declare function createAppWithWebSocket(deps: AppDeps): {
    app: Hono;
    injectWebSocket: (server: any) => void;
};
//# sourceMappingURL=server.d.ts.map