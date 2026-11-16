import type { EventBus } from "./event-bus.js";
import type { SessionRegistry } from "./session-registry.js";
import type { RigRepository } from "./rig-repository.js";
import type { BootstrapResult } from "./bootstrap-orchestrator.js";
export type KernelState = "skipped" | "auth_blocked" | "spec_missing" | "booting" | "partial_ready" | "ready" | "bootstrap_failed" | "degraded";
export interface KernelAgentStatus {
    /** Session name (e.g. `advisor-lead@kernel`). */
    sessionName: string;
    /** Runtime declared in the agent profile (claude-code / codex / terminal). */
    runtime: string;
    /** Startup status from the sessions table. Same enum as session-registry. */
    startupStatus: "pending" | "ready" | "attention_required" | "failed";
}
export interface KernelBootStatus {
    kernelState: KernelState;
    agents: KernelAgentStatus[];
    /** ISO timestamp of when the kernel first entered booting; null in
     *  terminal/skipped states. */
    firstUnreadySince: string | null;
    /** Filename of the picked variant (rig.yaml / rig-claude-only.yaml /
     *  rig-codex-only.yaml). null when no variant was selected. */
    variant: string | null;
    /** Human-readable detail for auth_blocked / spec_missing /
     *  bootstrap_failed / degraded states. null otherwise. */
    detail: string | null;
    /** A boot failure the kernel has since recovered from: every seat it expects is ready again, so
     *  kernelState is ready and this keeps the failure as history. null otherwise, including while
     *  the failure is still current. */
    lastBootFailure: {
        state: "bootstrap_failed" | "degraded";
        detail: string | null;
        at: string | null;
    } | null;
}
export interface KernelBootTrackerDeps {
    eventBus: EventBus;
    sessionRegistry: SessionRegistry;
    rigRepo: RigRepository;
    /** Milliseconds the tracker waits in `booting` before emitting
     *  `kernel.agent.degraded` and transitioning to the `degraded` state.
     *  Default 90_000 (90s) per IMPL-PRD §6.3 amendment. Tests pass
     *  shorter values; daemon startup honors the OPENRIG_KERNEL_DEGRADED_MS
     *  env override resolved by startup.ts. */
    degradedTimeoutMs?: number;
}
export declare class KernelBootTracker {
    private readonly deps;
    private state;
    private variant;
    private detail;
    private firstUnreadySince;
    private failedAt;
    /** The seats the booting kernel spec declares (`pod.member`). null when unknown, which keeps a
     *  boot failure current: recovery needs the whole expected roster, never just the rows present. */
    private expectedSeats;
    private degradedTimer;
    private degradedEmitted;
    private bootstrapInFlight;
    constructor(deps: KernelBootTrackerDeps);
    /** Mark the tracker as having intentionally not booted (--no-kernel,
     *  already-managed short-circuit, VITEST auto-skip). Terminal state;
     *  no degraded timer. */
    setSkipped(detail: string): void;
    /** Auth-blocked terminal. Operator sees the 3-part error in detail. */
    setAuthBlocked(message: string): void;
    /** Spec-missing terminal. Path is in detail for ops triage. */
    setSpecMissing(specPath: string): void;
    /** Begin tracking an in-flight bootstrap. The bootstrap promise
     *  is awaited internally; the caller does NOT block on it. */
    startBooting(variant: string, bootstrapPromise: Promise<BootstrapResult>, expectedSeats?: readonly string[] | null): void;
    /** Read current status. Computes agents[] live from the sessions
     *  table so the response always reflects the freshest startup_status. */
    getStatus(): KernelBootStatus;
    /** Stop the degraded timer. Safe to call from anywhere (idempotent).
     *  Production callers don't need this; tests + graceful daemon
     *  shutdown do. */
    stop(): void;
    private onBootstrapComplete;
    private onBootstrapError;
    private aggregateReadinessFromAgents;
    private computeAgents;
    /** A relaunch or `rig seat continue` adds a session row for the same node, so only each node's
     *  newest row is the seat's current startup status. */
    private latestSessionByNode;
    /** True only when every kernel node's newest session is ready and every expected seat has such a
     *  node. A node with no session is not ready, and a member that failed before its node was
     *  created is missing. False when the expected roster is unknown, and on any read error. */
    private rosterRecovered;
    private scheduleDegradedTimer;
    private cancelTimer;
    private checkDegraded;
}
//# sourceMappingURL=kernel-boot-tracker.d.ts.map