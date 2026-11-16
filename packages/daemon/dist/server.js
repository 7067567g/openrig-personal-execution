import { healthDiagnosisRoutes } from "./routes/health-diagnosis.js";
import { Hono } from "hono";
import fs from "node:fs";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { stampFields } from "./build-info.js";
import { rigsRoutes } from "./routes/rigs.js";
import { sessionsRoutes, nodesRoutes, sessionAdminRoutes } from "./routes/sessions.js";
import { adaptersRoutes } from "./routes/adapters.js";
import { eventsRoute } from "./routes/events.js";
import { snapshotsRoutes, restoreRoutes } from "./routes/snapshots.js";
import { handleExportYaml, handleExportJson, rigspecImportRoutes } from "./routes/rigspec.js";
import { packagesRoutes } from "./routes/packages.js";
import { bootstrapRoutes } from "./routes/bootstrap.js";
import { discoveryRoutes } from "./routes/discovery.js";
import { bundleRoutes } from "./routes/bundles.js";
import { restoreCheckRoutes } from "./routes/restore-check.js";
import { crashCartRoutes } from "./routes/crash-cart.js";
import { agentsRoutes } from "./routes/agents.js";
import { psRoutes } from "./routes/ps.js";
import { upRoutes } from "./routes/up.js";
import { infoRoutes } from "./routes/info.js";
import { downRoutes } from "./routes/down.js";
import { kernelStatusRoutes } from "./routes/kernel-status.js";
import { startupRoutes } from "./routes/startup.js";
import { transcriptRoutes } from "./routes/transcripts.js";
import { transportRoutes } from "./routes/transport.js";
import { compactionRoutes } from "./routes/compaction.js";
import { activityRoutes } from "./routes/activity.js";
import { askRoutes } from "./routes/ask.js";
import { wakeResolveRoutes } from "./routes/wake-resolve.js";
import { specReviewRoutes } from "./routes/spec-review.js";
import { specLibraryRoutes } from "./routes/spec-library.js";
// Phase 3a slice 3.3 — plugin discovery routes (read-only).
// SC-29 EXCEPTION #8 verbatim: see packages/daemon/src/routes/plugins.ts
// header for full declaration.
import { pluginsRoutes } from "./routes/plugins.js";
// Slice 28 Checkpoint C-3 — skill-library discovery routes (read-only).
// SC-29 EXCEPTION #11 cumulative; full declaration in routes/plugins.ts header.
import { skillsRoutes } from "./routes/skills.js";
import { configRoutes } from "./routes/config.js";
import { hostsRoutes } from "./routes/hosts.js";
import { hostReadThrough } from "./domain/hosts/read-through.js";
import { jsonBodyErrorHandler, trackJsonBodyParseErrors } from "./middleware/json-body-error.js";
import { getSelfHostId, getSelfHostIdSource } from "./domain/hosts/fanout-contract.js";
import { contextPacksRoutes } from "./routes/context-packs.js";
import { agentImagesRoutes } from "./routes/agent-images.js";
import { agentAppsRoutes } from "./routes/agent-apps.js";
import { whoamiRoutes } from "./routes/whoami.js";
import { providerRoutes } from "./routes/provider.js";
import { PermissionDriftObserver } from "./domain/permission-drift-observer.js";
import { chatRoutes } from "./routes/chat.js";
import { streamRoutes } from "./routes/stream.js";
import { queueRoutes } from "./routes/queue.js";
import { workspaceRoutes } from "./routes/workspace.js";
import { projectsRoutes } from "./routes/projects.js";
import { viewsRoutes } from "./routes/views.js";
import { watchdogRoutes } from "./routes/watchdog.js";
import { workflowRoutes } from "./routes/workflow.js";
import { missionControlRoutes } from "./routes/mission-control.js";
import { slicesRoutes } from "./routes/slices.js";
import { reviewRoutes } from "./routes/review.js";
import { rigModeRoutes } from "./routes/rig-mode.js";
import { missionsRoutes } from "./routes/missions.js";
import { rigCmuxRoutes } from "./routes/rig-cmux.js";
import { terminalRoutes, rigTerminalRoutes } from "./routes/terminal.js";
import { CmuxLayoutService } from "./domain/cmux-layout-service.js";
import { getNodeInventory } from "./domain/node-inventory.js";
import { filesRoutes } from "./routes/files.js";
import { progressRoutes } from "./routes/progress.js";
import { scopeAuditRoutes } from "./routes/scope-audit.js";
import { scopesRoutes } from "./routes/scopes.js";
import { telemetryRoutes } from "./routes/telemetry.js";
import { proofRoutes } from "./routes/proof.js";
import { scopeApproveRoutes } from "./routes/scope-approve.js";
import { registerTerminalAuthOnly, registerTerminalWs } from "./routes/terminal-ws.js";
import { createNodeWebSocket } from "@hono/node-ws";
import { steeringRoutes } from "./routes/steering.js";
import { healthSummaryRoutes } from "./routes/health-summary.js";
import { attentionRoutes } from "./routes/attention.js";
import { healthRoutes } from "./routes/health.js";
import { gatewayRoutes } from "./routes/gateway.js";
import { createSlowOpRequestMiddleware } from "./domain/slow-op-recorder.js";
import { envRoutes } from "./routes/env.js";
import { seatRoutes } from "./routes/seat.js";
import { createRouteTimingMiddleware } from "./domain/route-timing-recorder.js";
import { browserBoundary } from "./middleware/browser-boundary.js";
const MIME_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
};
function resolveDefaultUiDistDir() {
    return nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), "..", "..", "ui", "dist");
}
export const WEB_UI_OFF_MESSAGE = "The OpenRig web UI is off. To turn it on, run `rig config set ui.enabled true`, then stop and start the daemon (`rig daemon stop`, `rig daemon start`).\n";
function safeResolveUiPath(uiDistDir, requestPath) {
    const relativePath = requestPath.replace(/^\/+/, "") || "index.html";
    const resolvedPath = nodePath.resolve(uiDistDir, relativePath);
    const normalizedRoot = uiDistDir.endsWith(nodePath.sep) ? uiDistDir : `${uiDistDir}${nodePath.sep}`;
    if (resolvedPath !== uiDistDir && !resolvedPath.startsWith(normalizedRoot)) {
        return null;
    }
    return resolvedPath;
}
function fileResponse(filePath) {
    const ext = nodePath.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    const body = fs.readFileSync(filePath);
    return new Response(body, {
        headers: {
            "content-type": contentType,
        },
    });
}
function isUiAssetRequestPath(requestPath) {
    const relativePath = requestPath.replace(/^\/+/, "");
    return relativePath.startsWith("assets/")
        || relativePath === "favicon.ico"
        || relativePath === "robots.txt"
        || relativePath === "manifest.webmanifest";
}
export function createApp(deps) {
    // Hard runtime invariant: all domain services must share the same db handle.
    if (deps.rigRepo.db !== deps.eventBus.db) {
        throw new Error("createApp: rigRepo and eventBus must share the same db handle");
    }
    if (deps.rigRepo.db !== deps.sessionRegistry.db) {
        throw new Error("createApp: rigRepo and sessionRegistry must share the same db handle");
    }
    if (deps.rigRepo.db !== deps.snapshotRepo.db) {
        throw new Error("createApp: snapshotRepo must share the same db handle");
    }
    if (deps.rigRepo.db !== deps.snapshotCapture.db) {
        throw new Error("createApp: snapshotCapture must share the same db handle");
    }
    if (deps.rigRepo.db !== deps.restoreOrchestrator.db) {
        throw new Error("createApp: restoreOrchestrator must share the same db handle");
    }
    if (deps.rigRepo.db !== deps.rigSpecExporter.db) {
        throw new Error("createApp: rigSpecExporter must share the same db handle");
    }
    if (deps.rigRepo.db !== deps.rigSpecPreflight.db) {
        throw new Error("createApp: rigSpecPreflight must share the same db handle");
    }
    if (deps.rigRepo.db !== deps.rigInstantiator.db) {
        throw new Error("createApp: rigInstantiator must share the same db handle");
    }
    if (deps.rigRepo.db !== deps.packageRepo.db) {
        throw new Error("createApp: packageRepo must share the same db handle");
    }
    if (deps.rigRepo.db !== deps.installRepo.db) {
        throw new Error("createApp: installRepo must share the same db handle");
    }
    if (deps.rigRepo.db !== deps.bootstrapRepo.db) {
        throw new Error("createApp: bootstrapRepo must share the same db handle");
    }
    if (deps.rigRepo.db !== deps.discoveryRepo.db) {
        throw new Error("createApp: discoveryRepo must share the same db handle");
    }
    if (deps.rigRepo.db !== deps.claimService.db) {
        throw new Error("createApp: claimService must share the same db handle");
    }
    if (deps.selfAttachService && deps.rigRepo.db !== deps.selfAttachService.db) {
        throw new Error("createApp: selfAttachService must share the same db handle");
    }
    if (deps.rigRepo.db !== deps.psProjectionService.db) {
        throw new Error("createApp: psProjectionService must share the same db handle");
    }
    if (deps.rigRepo.db !== deps.teardownOrchestrator.db) {
        throw new Error("createApp: teardownOrchestrator must share the same db handle");
    }
    if (deps.rigRepo.db !== deps.podInstantiator.db) {
        throw new Error("createApp: podInstantiator must share the same db handle");
    }
    const app = new Hono();
    if (deps.requestPhaseObserver)
        app.use("*", deps.requestPhaseObserver.middleware());
    // A malformed request body is a 400, not the default 500.
    app.use("*", trackJsonBodyParseErrors);
    app.onError(jsonBodyErrorHandler);
    const permissionDriftObserver = deps.permissionDriftObserver
        ?? new PermissionDriftObserver({ db: deps.rigRepo.db });
    // Inject dependencies into context for all routes
    app.use("*", async (c, next) => {
        c.set("rigRepo", deps.rigRepo);
        c.set("sessionRegistry", deps.sessionRegistry);
        c.set("eventBus", deps.eventBus);
        c.set("nodeLauncher", deps.nodeLauncher);
        c.set("startupOrchestrator", deps.startupOrchestrator);
        c.set("tmuxAdapter", deps.tmuxAdapter);
        c.set("tmuxOptionDefaults", deps.tmuxOptionDefaults);
        c.set("sessionEnv", deps.sessionEnv);
        c.set("runtimeSessionEnv", deps.runtimeSessionEnv);
        c.set("cmuxAdapter", deps.cmuxAdapter);
        // S10 — the in-daemon gateway subsystem handle (health surface + dispatch seam).
        c.set("gatewaySubsystem", deps.gatewaySubsystem);
        // Slice 24 — per-rig CMUX workspace launcher wiring.
        c.set("cmuxLayoutService", new CmuxLayoutService(deps.cmuxAdapter));
        c.set("nodeInventoryFn", (rigId) => getNodeInventory(deps.rigRepo.db, rigId));
        c.set("snapshotCapture", deps.snapshotCapture);
        c.set("snapshotRepo", deps.snapshotRepo);
        c.set("providerService", deps.providerService);
        c.set("restoreOrchestrator", deps.restoreOrchestrator);
        c.set("resumeMetadataRefresher", deps.resumeMetadataRefresher);
        c.set("rigSpecExporter", deps.rigSpecExporter);
        c.set("rigSpecPreflight", deps.rigSpecPreflight);
        c.set("rigInstantiator", deps.rigInstantiator);
        c.set("packageRepo", deps.packageRepo);
        c.set("installRepo", deps.installRepo);
        c.set("installEngine", deps.installEngine);
        c.set("installVerifier", deps.installVerifier);
        c.set("bootstrapOrchestrator", deps.bootstrapOrchestrator);
        c.set("bootstrapRepo", deps.bootstrapRepo);
        c.set("discoveryCoordinator", deps.discoveryCoordinator);
        c.set("discoveryRepo", deps.discoveryRepo);
        c.set("claimService", deps.claimService);
        c.set("selfAttachService", deps.selfAttachService);
        c.set("rigExpansionService", deps.rigExpansionService);
        c.set("rigLifecycleService", deps.rigLifecycleService);
        c.set("psProjectionService", deps.psProjectionService);
        /** OPR.0.7.0 P1c — optional per-seat enforcement sources for `ps --resources`. */
        c.set("seatResources", deps.seatResources);
        c.set("upRouter", deps.upRouter);
        c.set("teardownOrchestrator", deps.teardownOrchestrator);
        c.set("podInstantiator", deps.podInstantiator);
        c.set("podBundleSourceResolver", deps.podBundleSourceResolver);
        c.set("runtimeAdapters", deps.runtimeAdapters ?? {});
        c.set("transcriptStore", deps.transcriptStore);
        c.set("sessionTransport", deps.sessionTransport);
        c.set("askService", deps.askService);
        c.set("wakeResolveService", deps.wakeResolveService);
        c.set("chatRepo", deps.chatRepo);
        c.set("streamStore", deps.streamStore);
        c.set("queueRepo", deps.queueRepo);
        c.set("inboxHandler", deps.inboxHandler);
        c.set("outboxHandler", deps.outboxHandler);
        c.set("shadowCapture", deps.shadowCapture);
        c.set("shadowCaptureError", deps.shadowCaptureError);
        c.set("projectClassifier", deps.projectClassifier);
        c.set("classifierLeaseManager", deps.classifierLeaseManager);
        c.set("classificationAttemptLedger", deps.classificationAttemptLedger);
        c.set("viewProjector", deps.viewProjector);
        c.set("watchdogJobsRepo", deps.watchdogJobsRepo);
        c.set("watchdogHistoryLog", deps.watchdogHistoryLog);
        c.set("watchdogPolicyEngine", deps.watchdogPolicyEngine);
        c.set("watchdogScheduler", deps.watchdogScheduler);
        c.set("workflowRuntime", deps.workflowRuntime);
        c.set("workflowBuiltinSpecsDir", deps.workflowBuiltinSpecsDir);
        c.set("workflowsFolderDir", deps.workflowsFolderDir);
        c.set("workflowSpecCache", deps.workflowSpecCache);
        c.set("missionControlReadLayer", deps.missionControlReadLayer);
        c.set("missionControlWriteContract", deps.missionControlWriteContract);
        c.set("missionControlActionLog", deps.missionControlActionLog);
        c.set("missionControlFleetCliCapability", deps.missionControlFleetCliCapability);
        c.set("sliceIndexer", deps.sliceIndexer);
        c.set("proofSourceWatch", deps.proofSourceWatch);
        c.set("sliceDetailProjector", deps.sliceDetailProjector);
        c.set("reviewGatherer", deps.reviewGatherer);
        c.set("terminalService", deps.terminalService);
        c.set("filesAllowlist", deps.filesAllowlist);
        c.set("settingsStore", deps.settingsStore);
        c.set("previewRateLimiter", deps.previewRateLimiter);
        c.set("fileWriteService", deps.fileWriteService);
        c.set("progressIndexer", deps.progressIndexer);
        c.set("steeringComposer", deps.steeringComposer);
        c.set("missionControlAuditBrowse", deps.missionControlAuditBrowse);
        c.set("missionControlNotificationDispatcher", deps.missionControlNotificationDispatcher);
        c.set("specReviewService", deps.specReviewService);
        c.set("specLibraryService", deps.specLibraryService);
        c.set("pluginDiscoveryService", deps.pluginDiscoveryService);
        c.set("skillLibraryDiscoveryService", deps.skillLibraryDiscoveryService);
        c.set("activeLensStore", deps.activeLensStore);
        c.set("contextPackLibrary", deps.contextPackLibrary);
        c.set("agentImageLibrary", deps.agentImageLibrary);
        c.set("snapshotCapturer", deps.snapshotCapturer);
        c.set("whoamiService", deps.whoamiService);
        c.set("permissionDriftObserver", permissionDriftObserver);
        c.set("contextUsageStore", deps.contextUsageStore);
        c.set("healthProjection", deps.healthProjection);
        c.set("healthDiagnosis", deps.healthDiagnosis);
        c.set("healthPolicy", deps.healthPolicy);
        c.set("healthCheckpoints", deps.healthCheckpoints);
        c.set("contextMonitor", deps.contextMonitor);
        c.set("compactionEnforcer", deps.compactionEnforcer);
        c.set("occupantInvalidator", deps.occupantInvalidator);
        c.set("nodeCmuxService", deps.nodeCmuxService);
        c.set("agentActivityStore", deps.agentActivityStore);
        c.set("seatAttentionReconciler", deps.seatAttentionReconciler);
        // Slice 15 — wire seatActivityService into request context so the
        // /api/rigs/:id/nodes route can enrich entries with terminalActive +
        // hasAssignedWork via attachTerminalActivityAndWork.
        c.set("seatActivityService", deps.seatActivityService);
        c.set("seatStructuralActivityService", deps.seatStructuralActivityService);
        c.set("activityHookToken", deps.activityHookToken);
        c.set("serviceOrchestrator", deps.serviceOrchestrator);
        c.set("composeAdapter", deps.composeAdapter);
        c.set("kernelBootTracker", deps.kernelBootTracker);
        c.set("rigModeStore", deps.rigModeStore);
        c.set("operatingPosture", deps.operatingPosture);
        c.set("db", deps.rigRepo.db);
        c.set("terminalBearerToken", deps.terminalBearerToken ?? null);
        await next();
    });
    // OPR.0.4.3.21 — ONE request-duration middleware for the expensive topology
    // routes (rigs summary/graph, nodes, ps). Registered only when a recorder is
    // wired (production); the internal expensiveRouteLabel gate makes it a no-op
    // for every other path, so cheap routes pay nothing.
    if (deps.routeTimingRecorder) {
        app.use("*", createRouteTimingMiddleware(deps.routeTimingRecorder));
    }
    // The request-timing observer, wired via the exported seam (createSlowOpRequestMiddleware) so the
    // middleware contract is unit-tested hermetically and this line is the pinned enable path. Registered
    // only when a recorder is wired (production); measurement-only + isolated (a throw never becomes a 500).
    if (deps.slowOpRecorder?.recordRequest) {
        app.use("*", createSlowOpRequestMiddleware(deps.slowOpRecorder));
    }
    // Browser boundary: target name and browser Origin, checked once per /api request
    // (WebSocket upgrades included), before the remote read-through and every route.
    app.use("/api/*", browserBoundary({
        webUiEnabled: deps.webUiEnabled === true,
        bearerTokens: [deps.terminalBearerToken, deps.missionControlBearerToken],
        allowedOrigins: process.env.OPENRIG_ALLOWED_ORIGINS,
        allowedHosts: process.env.OPENRIG_ALLOWED_HOSTS,
        discoverSelfNames: deps.selfNameDiscovery,
        onDecision: deps.browserBoundaryObserver,
    }));
    // OPR.0.4.6.MH2 FR-2/FR-7 — the single-host READ-THROUGH edge (the read
    // twin of the mission-control remote-forward). Consumes a `?host=<id>`
    // envelope on allowlisted GET reads; refuses non-GET / non-allowlisted
    // requests carrying a remote envelope with a structured MH-3-boundary
    // error, never forwarding them. Absent/local host param falls through to
    // the existing handlers untouched (the FR-2 zero-regression negative).
    app.use("/api/*", hostReadThrough());
    app.get("/healthz", (c) => {
        // OPR.0.4.3.21 — enrich the health surface with event-loop wedge evidence
        // when the monitor is wired. Absent monitor keeps the exact legacy body so
        // existing probes / tests that assert `{ status: "ok" }` are unchanged.
        // OPR.0.4.4.11 FR-7 — a STAMPED build additionally carries
        // {semver, commit, dirty, builtAt}; dev runs add NOTHING (stampFields is
        // {} without a stamp — no invented identity, legacy bodies preserved).
        const stamp = stampFields();
        // 51-09 increment 3 (arch ruling 2e1b737f; local always-suffix rendering since
        // superseded by the 2026-08-27 root invariant) — expose the daemon's boot-reconciled
        // self-host id so the CLI edge can detect cross-host targets, self-resolve a
        // self-suffixed reply hint, and construct the origin triple at the FORWARDING
        // boundary (ONE identity source). ADDITIVE
        // on the FR-7 stamp precedent: ABSENT before the boot reconcile (getSelfHostId
        // is null → {} → no invented identity, legacy bodies byte-preserved). NEVER
        // ownName/host.name (display-only, DP4 — the conflation this slice kills).
        const self = getSelfHostId();
        // Slice 14 §2c — legibility BEFORE the cross-machine failure. A host running a generated id is
        // in a materially different state from one running its registered name (remote callers cannot
        // resolve it), and until now nothing said which state you were in until a message failed.
        const selfHost = self
            ? {
                selfHostId: self,
                selfHostIdSource: getSelfHostIdSource(),
            }
            : {};
        const monitor = deps.eventLoopMonitor;
        const slowOperations = deps.slowOpRecorder?.snapshot
            ? { slowOperations: deps.slowOpRecorder.snapshot() }
            : {};
        // S20 — bind provenance on the health surface (ADDITIVE; absent = legacy body):
        // adoption gates derive the REQUIRED listener set from this and then prove each
        // host by probing it — binding evidence, never config echo.
        const bind = deps.bindPlan ? { bind: deps.bindPlan } : {};
        // S02 — quiet is cheap but observable: the standing stuck sweep's heartbeat rides
        // healthz (ADDITIVE; absent = legacy body), so a clean sweep needs no row and a
        // failing sweep is loud without one.
        const stuckSweep = deps.stuckSweepStatus ? { stuckSweep: deps.stuckSweepStatus.snapshot() } : {};
        // S01 — the wake ladder's heartbeat is half of the operator rung's honest delivery
        // floor (escalation view + daemon-health); same additive contract.
        const wakeLadder = deps.wakeLadderStatus ? { wakeLadder: deps.wakeLadderStatus.snapshot() } : {};
        if (!monitor) {
            return c.json({ status: "ok", pid: process.pid, ...stamp, ...selfHost, ...slowOperations, ...bind, ...stuckSweep, ...wakeLadder });
        }
        const eventLoop = monitor.snapshot();
        return c.json({
            status: "ok",
            pid: process.pid,
            ...stamp,
            ...selfHost,
            eventLoop,
            routeTimings: deps.routeTimingRecorder?.snapshot() ?? {},
            ...slowOperations,
            ...bind,
            ...stuckSweep,
            ...wakeLadder,
        });
    });
    app.route("/api/rigs", rigsRoutes);
    app.route("/api/rigs/:rigId/sessions", sessionsRoutes);
    // Slice 24 — per-rig CMUX workspace launcher.
    app.route("/api/rigs/:rigId/cmux", rigCmuxRoutes);
    app.route("/api/rigs/:rigId/nodes", nodesRoutes);
    app.route("/api/sessions", sessionAdminRoutes);
    app.route("/api/adapters", adaptersRoutes);
    app.route("/api/events", eventsRoute);
    app.route("/api/rigs/:rigId/snapshots", snapshotsRoutes);
    app.route("/api/rigs/:rigId/restore", restoreRoutes);
    app.route("/api/crash-cart", crashCartRoutes);
    app.route("/api/rigs/import", rigspecImportRoutes);
    app.get("/api/rigs/:rigId/spec", handleExportYaml);
    app.get("/api/rigs/:rigId/spec.json", handleExportJson);
    app.route("/api/packages", packagesRoutes);
    app.route("/api/agents", agentsRoutes);
    app.route("/api/bootstrap", bootstrapRoutes);
    app.route("/api/discovery", discoveryRoutes);
    app.route("/api/bundles", bundleRoutes);
    app.route("/api/ps", psRoutes);
    app.route("/api/up", upRoutes);
    app.route("/api/info", infoRoutes());
    app.route("/api/down", downRoutes);
    app.route("/api/kernel", kernelStatusRoutes);
    app.route("/api/startup", startupRoutes);
    app.route("/api/transcripts", transcriptRoutes());
    app.route("/api/transport", transportRoutes({ bearerToken: deps.terminalBearerToken ?? null }));
    // OPR.0.4.3.14 — manual compaction trigger (same terminal-bearer posture as
    // transport, since it drives a send into the target seat).
    app.route("/api/compaction", compactionRoutes({ bearerToken: deps.terminalBearerToken ?? null }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let injectWebSocket = () => { };
    // The terminal WebSocket only serves the web UI, so it exists only while the web UI is on.
    if (deps.enableNodeWebSocket && deps.webUiEnabled === true) {
        const ws = createNodeWebSocket({ app });
        injectWebSocket = ws.injectWebSocket;
        _lastInjectWebSocket = injectWebSocket;
        registerTerminalWs(app, ws.upgradeWebSocket, { bearerToken: deps.terminalBearerToken ?? null });
    }
    else if (deps.enableNodeWebSocket) {
        registerTerminalAuthOnly(app, { bearerToken: deps.terminalBearerToken ?? null });
    }
    app.route("/api/activity", activityRoutes);
    app.route("/api/ask", askRoutes);
    app.route("/api/wake-resolve", wakeResolveRoutes);
    app.route("/api/specs/review", specReviewRoutes());
    app.route("/api/specs/library", specLibraryRoutes());
    app.route("/api/plugins", pluginsRoutes());
    // Slice 28 C-3 — skill-library + per-skill file endpoints (SC-29 #11).
    app.route("/api/skills", skillsRoutes());
    app.route("/api/config", configRoutes());
    app.route("/api/context-packs", contextPacksRoutes());
    app.route("/api/agent-images", agentImagesRoutes({
        specRoots: deps.agentImageSpecRoots ?? (() => []),
    }));
    app.route("/api/agent-apps", agentAppsRoutes());
    app.route("/api/whoami", whoamiRoutes());
    // Slice-04 OPR.0.5.0.4: registered so the endpoints exist and 503 honestly; the providerService
    // is not set in context until the collection/service seam (C) wires it (until then -> 503).
    app.route("/api/provider", providerRoutes());
    app.route("/api/seat", seatRoutes);
    app.route("/api/rigs/:rigId/chat", chatRoutes());
    app.route("/api/stream", streamRoutes());
    app.route("/api/queue", queueRoutes());
    app.route("/api/workspace", workspaceRoutes());
    app.route("/api/projects", projectsRoutes());
    app.route("/api/views", viewsRoutes());
    app.route("/api/watchdog", watchdogRoutes());
    app.route("/api/workflow", workflowRoutes());
    app.route("/api/mission-control", missionControlRoutes({ bearerToken: deps.missionControlBearerToken ?? null }));
    // OPR.0.4.6.MH1 FR-5/FR-6 — THE narrow named host add/pair route family
    // (arch P1: add + pair handshake only). Same operator-bearer posture as
    // mission-control for the write seams; the pair-request issuance legs
    // are deliberately open (pre-token bootstrap).
    app.route("/api/hosts", hostsRoutes({ bearerToken: deps.missionControlBearerToken ?? null }));
    // Slice Story View v0 — slice indexer + per-tab payload routes.
    app.route("/api/slices", slicesRoutes());
    // Living Notes Packet 2 (OPR.0.4.4.20) — composed-review read contract.
    app.route("/api/review", reviewRoutes());
    // OPR.0.4.6.02 C3 — the canonical non-rig-scoped terminal composer + the
    // rig-scoped thin alias (composes view=rig:<rigId>, delegates to the same
    // TerminalService; arch R1 / guard b1).
    app.route("/api/terminal", terminalRoutes());
    app.route("/api/rigs/:rigId/terminal", rigTerminalRoutes);
    // V0.3.1 slice 12 walk-item 1 — mission scope data layer
    // (aggregated mission metadata + slices filter; pairs with
    // useScopeMarkdown for README / PROGRESS content via /api/files/read).
    app.route("/api/missions", missionsRoutes());
    // UI Enhancement Pack v0 — files (item 3 + item 4) + progress (item 1B) routes.
    app.route("/api/files", filesRoutes());
    app.route("/api/progress", progressRoutes());
    app.route("/api/scope/audit", scopeAuditRoutes());
    // SCOPES VIEW (d64d2f5c): the store-direct TUI read.
    app.route("/api/scopes", scopesRoutes());
    // 51-08 A3 — usage series + top-N burn over usage_samples (one projection, CLI+HTTP).
    app.route("/api/telemetry", telemetryRoutes({ db: () => deps.rigRepo.db,
        source: { hostId: getSelfHostId(), bootEpoch: deps.daemonBootEpoch ?? null } }));
    // OPR.0.4.4.19 FR-9 — scope approve: frontmatter stamp + audit row.
    app.route("/api/scope/approve", scopeApproveRoutes());
    app.route("/api/proof", proofRoutes());
    // Operator Surface Reconciliation v0 — steering composition + health summary.
    app.route("/api/steering", steeringRoutes());
    app.route("/api/health-summary", healthSummaryRoutes());
    app.route("/api/health", healthRoutes());
    app.route("/api/attention", attentionRoutes());
    app.route("/api/health-diagnosis", healthDiagnosisRoutes());
    // S10 — gateway subsystem admin (slack enable/disable with the seeding rule preserved).
    app.route("/api/gateway", gatewayRoutes());
    app.route("/api/rigs/:rigId/env", envRoutes());
    app.route("/api/restore-check", restoreCheckRoutes);
    // Slice 09 (OPR.0.3.2.9) — rig-policy bindings (operator context mode).
    // Same operator-bearer posture as mission-control; HG-SAFE preserved.
    app.route("/api/rig-mode", rigModeRoutes({ bearerToken: deps.missionControlBearerToken ?? null }));
    app.all("/api/*", async (c, next) => {
        if (c.req.path === "/api")
            return next();
        return c.json({ error: "not_found", path: c.req.path }, 404);
    });
    const uiDistDir = deps.uiDistDir ?? resolveDefaultUiDistDir();
    const uiIndexPath = nodePath.join(uiDistDir, "index.html");
    const hasUiBundle = !!uiDistDir && fs.existsSync(uiIndexPath);
    app.get("*", (c) => {
        const requestPath = c.req.path;
        if (requestPath === "/healthz" || requestPath.startsWith("/api/")) {
            return c.notFound();
        }
        if (deps.webUiEnabled !== true) {
            c.header("X-OpenRig-Web-UI", "off");
            return c.text(WEB_UI_OFF_MESSAGE, 404);
        }
        if (!hasUiBundle) {
            return c.notFound();
        }
        const requestedFile = safeResolveUiPath(uiDistDir, requestPath);
        if (requestedFile && fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()) {
            return fileResponse(requestedFile);
        }
        if (isUiAssetRequestPath(requestPath)) {
            return c.notFound();
        }
        const indexHtml = fs.readFileSync(uiIndexPath, "utf-8");
        const tokenScript = deps.terminalBearerToken
            ? `<script>if(!window.localStorage.getItem("openrig.terminalBearerToken"))window.localStorage.setItem("openrig.terminalBearerToken",${JSON.stringify(deps.terminalBearerToken)})</script>`
            : "";
        const injected = tokenScript ? indexHtml.replace("</head>", `${tokenScript}</head>`) : indexHtml;
        return c.html(injected);
    });
    return app;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _lastInjectWebSocket = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAppWithWebSocket(deps) {
    deps.enableNodeWebSocket = true;
    _lastInjectWebSocket = null;
    const app = createApp(deps);
    return { app, injectWebSocket: _lastInjectWebSocket ?? (() => { }) };
}
//# sourceMappingURL=server.js.map