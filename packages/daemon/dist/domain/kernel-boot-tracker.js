// V0.3.1 slice 05 kernel-rig-as-default — forward-fix #3 architectural.
// Decouples daemon health/listen from kernel-agent readiness.
//
// Prior behavior: `bootKernelIfNeeded` awaited `bootstrapOrchestrator.bootstrap(...)`
// inside `createDaemon`, so the daemon process couldn't reach `serve()` until
// the kernel rig's members had been launched + their startup deliveries
// completed. A broken kernel agent (e.g., Codex unauthenticated mid-boot)
// stalled healthz too. The CLI then reported "daemon failed to start" even
// though the daemon itself was perfectly happy — only the *kernel* was sad.
//
// New behavior: `bootKernelIfNeeded` builds a tracker, fires the bootstrap
// in the background, and returns immediately. The daemon binds healthz as
// soon as `createDaemon` completes (HTTP server bind happens in server.ts
// right after). Tracker state is published via GET /api/kernel/status so
// operators (and CLI flags like `--wait-for-kernel`) can observe progress.
//
// A configurable degraded-timer (default 90s) emits a single
// `kernel.agent.degraded` event if the kernel doesn't reach a ready / partial-
// ready state in time — telemetry that something is keeping the kernel
// stuck (auth / spec / tmux / etc.).
export class KernelBootTracker {
    deps;
    state = "skipped";
    variant = null;
    detail = null;
    firstUnreadySince = null;
    failedAt = null;
    /** The seats the booting kernel spec declares (`pod.member`). null when unknown, which keeps a
     *  boot failure current: recovery needs the whole expected roster, never just the rows present. */
    expectedSeats = null;
    degradedTimer = null;
    degradedEmitted = false;
    bootstrapInFlight = false;
    constructor(deps) {
        this.deps = deps;
    }
    /** Mark the tracker as having intentionally not booted (--no-kernel,
     *  already-managed short-circuit, VITEST auto-skip). Terminal state;
     *  no degraded timer. */
    setSkipped(detail) {
        this.cancelTimer();
        this.state = "skipped";
        this.detail = detail;
        this.firstUnreadySince = null;
    }
    /** Auth-blocked terminal. Operator sees the 3-part error in detail. */
    setAuthBlocked(message) {
        this.cancelTimer();
        this.state = "auth_blocked";
        this.detail = message;
        this.firstUnreadySince = null;
    }
    /** Spec-missing terminal. Path is in detail for ops triage. */
    setSpecMissing(specPath) {
        this.cancelTimer();
        this.state = "spec_missing";
        this.detail = specPath;
        this.firstUnreadySince = null;
    }
    /** Begin tracking an in-flight bootstrap. The bootstrap promise
     *  is awaited internally; the caller does NOT block on it. */
    startBooting(variant, bootstrapPromise, expectedSeats) {
        if (this.bootstrapInFlight)
            return;
        this.bootstrapInFlight = true;
        this.state = "booting";
        this.variant = variant;
        this.detail = null;
        this.firstUnreadySince = new Date().toISOString();
        this.failedAt = null;
        this.expectedSeats = expectedSeats && expectedSeats.length > 0 ? [...expectedSeats] : null;
        this.degradedEmitted = false;
        this.scheduleDegradedTimer();
        bootstrapPromise
            .then((result) => this.onBootstrapComplete(result))
            .catch((err) => this.onBootstrapError(err));
    }
    /** Read current status. Computes agents[] live from the sessions
     *  table so the response always reflects the freshest startup_status. */
    getStatus() {
        const agents = this.computeAgents();
        const state = this.state;
        let kernelState = state;
        let lastBootFailure = null;
        // Once bootstrap has completed (state == 'booting' before then),
        // promote to ready / partial_ready based on agent startup_status.
        if (state === "booting" && !this.bootstrapInFlight) {
            kernelState = this.aggregateReadinessFromAgents(agents);
        }
        else if ((state === "bootstrap_failed" || state === "degraded")
            && !this.bootstrapInFlight
            && this.aggregateReadinessFromAgents(agents) === "ready"
            && this.rosterRecovered()) {
            // Every seat the kernel expects has since reached ready (a resolved startup gate, a
            // `rig seat continue`), so the failure is history, not current health. A seat that is not
            // ready, has no session, or has no node keeps it current, and so does an unknown roster.
            kernelState = "ready";
            lastBootFailure = { state, detail: this.detail, at: this.failedAt };
        }
        return {
            kernelState,
            agents,
            firstUnreadySince: kernelState === "ready" || kernelState === "skipped"
                ? null
                : this.firstUnreadySince,
            variant: this.variant,
            detail: lastBootFailure ? null : this.detail,
            lastBootFailure,
        };
    }
    /** Stop the degraded timer. Safe to call from anywhere (idempotent).
     *  Production callers don't need this; tests + graceful daemon
     *  shutdown do. */
    stop() {
        this.cancelTimer();
    }
    onBootstrapComplete(result) {
        this.bootstrapInFlight = false;
        if (result.errors && result.errors.length > 0) {
            this.cancelTimer();
            this.state = "bootstrap_failed";
            this.detail = result.errors.join("; ");
            this.failedAt = new Date().toISOString();
            return;
        }
        // Bootstrap returned cleanly. State transitions to ready /
        // partial_ready are computed on read from agents[]. Cancel the
        // degraded timer ONLY when at least one agent is ready — until
        // then, the kernel is still effectively booting and the operator
        // wants the degraded telemetry if no agent ever reaches ready.
        const agents = this.computeAgents();
        const aggregated = this.aggregateReadinessFromAgents(agents);
        if (aggregated === "ready" || aggregated === "partial_ready") {
            this.cancelTimer();
        }
    }
    onBootstrapError(err) {
        this.bootstrapInFlight = false;
        this.cancelTimer();
        this.state = "bootstrap_failed";
        this.detail = err instanceof Error ? err.message : String(err);
        this.failedAt = new Date().toISOString();
    }
    aggregateReadinessFromAgents(agents) {
        if (agents.length === 0) {
            // Bootstrap finished but no agents are registered yet (race
            // window between session insert + status update). Keep state
            // as booting so the operator sees progress, not a false ready.
            return "booting";
        }
        const readyCount = agents.filter((a) => a.startupStatus === "ready").length;
        if (readyCount === agents.length)
            return "ready";
        if (readyCount === 0)
            return "booting";
        return "partial_ready";
    }
    computeAgents() {
        try {
            // Archived kernel generations aren't the current kernel.
            const out = [];
            for (const rig of this.deps.rigRepo.findUnarchivedRigsByName("kernel")) {
                // One entry per seat. The runtime is on the node row, not the session.
                const runtimeByNode = new Map((this.deps.rigRepo.getRig(rig.id)?.nodes ?? []).map((node) => [node.id, node.runtime]));
                for (const s of this.latestSessionByNode(rig.id).values()) {
                    out.push({
                        sessionName: s.sessionName,
                        runtime: runtimeByNode.get(s.nodeId) ?? "unknown",
                        startupStatus: s.startupStatus,
                    });
                }
            }
            return out;
        }
        catch {
            // Tracker must NEVER throw — /api/kernel/status returning a
            // valid envelope with empty agents[] is more useful than a 500
            // when the DB has a transient hiccup.
            return [];
        }
    }
    /** A relaunch or `rig seat continue` adds a session row for the same node, so only each node's
     *  newest row is the seat's current startup status. */
    latestSessionByNode(rigId) {
        const latestByNode = new Map();
        for (const s of this.deps.sessionRegistry.getSessionsForRig(rigId)) {
            const prior = latestByNode.get(s.nodeId);
            if (!prior || s.createdAt > prior.createdAt || (s.createdAt === prior.createdAt && s.id > prior.id)) {
                latestByNode.set(s.nodeId, s);
            }
        }
        return latestByNode;
    }
    /** True only when every kernel node's newest session is ready and every expected seat has such a
     *  node. A node with no session is not ready, and a member that failed before its node was
     *  created is missing. False when the expected roster is unknown, and on any read error. */
    rosterRecovered() {
        if (!this.expectedSeats)
            return false;
        try {
            const readySeats = new Set();
            for (const rig of this.deps.rigRepo.findUnarchivedRigsByName("kernel")) {
                const latest = this.latestSessionByNode(rig.id);
                for (const node of this.deps.rigRepo.getRig(rig.id)?.nodes ?? []) {
                    if (latest.get(node.id)?.startupStatus !== "ready")
                        return false;
                    readySeats.add(node.logicalId);
                }
            }
            return readySeats.size > 0 && this.expectedSeats.every((seat) => readySeats.has(seat));
        }
        catch {
            return false;
        }
    }
    scheduleDegradedTimer() {
        const ms = this.deps.degradedTimeoutMs ?? 90_000;
        if (ms <= 0)
            return;
        this.cancelTimer();
        this.degradedTimer = setTimeout(() => this.checkDegraded(), ms);
        // Allow the daemon to exit cleanly without waiting on the timer.
        if (typeof this.degradedTimer === "object" && "unref" in this.degradedTimer) {
            this.degradedTimer.unref();
        }
    }
    cancelTimer() {
        if (this.degradedTimer !== null) {
            clearTimeout(this.degradedTimer);
            this.degradedTimer = null;
        }
    }
    checkDegraded() {
        const agents = this.computeAgents();
        const aggregated = this.state === "booting"
            ? this.aggregateReadinessFromAgents(agents)
            : this.state;
        if (aggregated === "ready" || aggregated === "partial_ready") {
            // Made it before the deadline; no degraded emission.
            return;
        }
        // Promote to degraded + emit telemetry exactly once.
        if (this.degradedEmitted)
            return;
        this.degradedEmitted = true;
        this.state = "degraded";
        this.failedAt = new Date().toISOString();
        try {
            this.deps.eventBus.emit({
                type: "kernel.agent.degraded",
                agents: agents.map((a) => ({
                    sessionName: a.sessionName,
                    runtime: a.runtime,
                    startupStatus: a.startupStatus,
                })),
                firstUnreadySince: this.firstUnreadySince,
                detail: this.detail,
            });
        }
        catch {
            // Best-effort telemetry; tracker must not throw.
        }
    }
}
//# sourceMappingURL=kernel-boot-tracker.js.map