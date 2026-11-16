import { type SeatEnv } from "./seat-env.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { DiscoveryRepository } from "./discovery-repository.js";
import type { RuntimeAdapter, ForkSource } from "./runtime-adapter.js";
import type { AppliedLaunchObservation } from "./permission-drift.js";
import type { TmuxOptionDefaultsApplier } from "./tmux-option-defaults.js";
import { SettingsStore } from "./user-settings/settings-store.js";
/**
 * OPR.0.4.3.04 — the explicit successor-creation seam for the seat-handover
 * full-cycle composer (IMPL-SPEC §2.1b; resolves the rev1-dual BLOCKING B1).
 *
 * It creates an UNMANAGED, discoverable tmux successor for a non-discovered
 * handover source (fresh), routes it through REAL runtime startup so it becomes
 * a LIVE, READY agent (not a bare shell), records it as an ACTIVE discovery
 * candidate, and returns that candidate + the captured launch resume token so
 * the composer can route it through the EXISTING discovered->commit rebind path.
 * It deliberately does NOT `registerClaimedSession`/`upsertBinding` — the
 * session stays unmanaged until the handover `commit` claims it, so the
 * departing seat's binding is never touched before successor readiness.
 *
 * B1 (rev1-dual fix): the successor is launched through the runtime adapter's
 * `launchHarness` + readiness poll — the SAME startup/readiness primitives
 * `StartupOrchestrator` drives — WITHOUT the ahead-of-commit managed-session
 * registration those `StartupOrchestrator.startNode` bookkeeping steps would
 * require (updateStartupStatus / node_startup_context / updateResumeToken by
 * sessionId all need a registered session row). Driving the adapter primitives
 * directly is how we make the successor a live agent while keeping it unmanaged
 * until commit. Any launch/readiness failure UNWINDS the created session and
 * leaves the original binding intact (commit never runs).
 *
 * Why not `NodeLauncher.launchNode`: it refuses a bound node and, on success,
 * registers a managed session + binding in the same transaction — which would
 * trip `successor_already_managed` in the commit path. This seam creates a
 * DISTINCT unmanaged session instead.
 */
export interface SuccessorNode {
    id: string;
    runtime: string | null;
    cwd: string | null;
    /** OPR.0.4.8.3 Seam B: the departing seat's PERSISTED resolved launch posture —
     *  the successor is a CONTINUITY edge of the same seat, so its policy posture
     *  carries (populated by the caller from node provenance; absent = env decision). */
    launchPosture?: "floor" | "full_bypass" | "auto";
    nonInterruptive?: boolean;
    kernelAuthority?: boolean;
    teamPermissionDefault?: boolean;
    permissionMode?: string;
    /** 0.5.2-07 model fidelity: the seat's SPEC-pinned model (nodes.model). The successor is a continuity
     *  edge of the same seat, so its launch must READ THE SPEC — a launch path that drops it makes the
     *  running topology drift from the founder-designed one. Populated by the caller from node provenance;
     *  absent → the adapter emits no model flag (unchanged for legacy/unpinned seats). */
    model?: string | null;
    /** #75: the seat's effort, from the shared resolver (OPR.0.7.0.7 seat-effort.ts). Carried to successor launch. */
    effort?: string | null;
    /** 0.5.2-07 A4-profile: the seat's SPEC-pinned codex config profile (nodes.codex_config_profile).
     *  Same continuity rationale as model — populated by the caller from node provenance; absent → the
     *  adapter emits no -p flag (unchanged for legacy/unpinned seats). */
    codexConfigProfile?: string | null;
    /** The seat's declared launch environment (its rig's `env:` with the member's over it). The
     *  successor is the same seat, so it gets the same environment; absent = none declared. */
    seatEnv?: SeatEnv;
    /** Set when the seat loads the openrig-core plugin: its launch project, handed to the successor as OPENRIG_SEAT_PROJECT_DIR. */
    seatProjectDir?: string;
}
export type SuccessorLaunchResult = {
    ok: true;
    discoveredId: string;
    tmuxSession: string;
    tmuxPane: string;
    resumeToken?: string;
    resumeType?: string;
    appliedLaunch?: AppliedLaunchObservation;
    /**
     * OPR.0.4.6.02 S1 — non-fatal tmux option-default warnings from the
     * fresh successor's launch (mouse/status/clipboard). Present only when
     * an option-set degraded; omitted (undefined) on the clean path so the
     * shape stays byte-compatible with pre-02 successors.
     */
    warnings?: string[];
} | {
    ok: false;
    code: string;
    step: "create_successor" | "resolve_pane" | "start_agent";
    message: string;
    /** True once the predecessor process has been replaced in its pane. */
    replacementStarted: boolean;
};
export declare class SuccessorSessionLauncher {
    private tmuxAdapter;
    private discoveryRepo;
    private sessionEnv;
    private runtimeSessionEnv;
    private newId;
    private runtimeAdapters;
    private readinessTimeoutMs;
    private readinessSettings;
    private sleep;
    private tmuxOptionDefaults;
    private exitPollMs;
    private exitTimeoutMs;
    constructor(tmuxAdapter: TmuxAdapter, discoveryRepo: DiscoveryRepository, opts?: {
        sessionEnv?: Record<string, string | undefined>;
        /** Extra env for one runtime only, merged over sessionEnv (see NodeLauncher). */
        runtimeSessionEnv?: Record<string, Record<string, string | undefined>>;
        newId?: () => string;
        /** Runtime adapters keyed by runtime, used to launch + ready-probe the
         *  successor agent. Absent → a fresh successor cannot be launched. */
        runtimeAdapters?: Record<string, RuntimeAdapter>;
        /** Explicit readiness timeout in ms; otherwise use the runtime setting. */
        readinessTimeoutMs?: number;
        readinessSettings?: Pick<SettingsStore, "resolveOne">;
        /** Injectable sleep (tests). */
        sleep?: (ms: number) => Promise<void>;
        /**
         * OPR.0.4.6.02 S1 — the SHARED tmux option-defaults applier. A FRESH
         * successor is a new operator/agent seat (same launch-only class as
         * NodeLauncher), so it gets the same mouse/status/clipboard defaults on
         * its just-created session. Omitted → option application is skipped.
         */
        tmuxOptionDefaults?: TmuxOptionDefaultsApplier;
        /** Cutover retiree-exit poll interval + total bounded timeout (per graceful/forced phase). */
        exitPollMs?: number;
        exitTimeoutMs?: number;
    });
    /**
     * Create the unmanaged successor tmux session, launch it into a LIVE agent,
     * and record it as an active discovery candidate. The candidate satisfies the
     * discovered->commit guards: active (upsert sets status='active'), distinct
     * name, matching runtime hint, unmanaged (no binding/session claims it),
     * tmux-present (just created). The returned resume token (if any) is the
     * launch-scraped token the composer persists at commit (B2 for fresh).
     */
    createSuccessor(input: {
        node: SuccessorNode;
        departingSessionName: string;
        occupantGeneration?: string | null;
        /** Synchronous physical-cutover observer; runs after the retiree is proven gone and before respawn. */
        onReplacementStarted?: () => void;
        /** OPR.0.5.5.5 fork source: the successor launches as a NATIVE FORK of this
         *  resolved id (adapter forkSource seam) — it carries the incumbent's
         *  conversation from its first byte; the returned resume token is the NEW
         *  post-fork token, never the parent's. Absent → a plain fresh launch. */
        forkSource?: ForkSource;
    }): Promise<SuccessorLaunchResult>;
    /**
     * B1 — launch the successor into a live, ready agent via the runtime adapter's
     * `launchHarness` + readiness probe (the same primitives StartupOrchestrator
     * drives), capturing the launch resume token. No session/binding is
     * registered — the successor stays unmanaged until commit. The token is NEVER
     * logged or placed in a returned message.
     */
    private startAgent;
    /**
     * Wait for harness readiness with exponential backoff (1s→2s→…→16s cap,
     * configured timeout (30s by default) — mirrors StartupOrchestrator.waitForReady.
     */
    private waitForReady;
    /**
     * Cutover: terminate the retiree occupant in its pane so the successor can respawn into it while
     * preserving scrollback (the shared in-place cutover, pane-cutover.ts). Returns which path terminated
     * the retiree, or a failure if it never became dead (then commit never runs).
     * (Graceful signal = SIGTERM as the desk-provisional default under build-ahead; dev-planner ratifies
     * the exact graceful mechanism — SIGTERM vs a runtime-specific quit — at their resume.)
     */
    private terminateRetiree;
    /** KI-14: is the respawned pane's foreground a bare shell? A non-shell here means the pane booted
     *  a baked-in command (the resumed-old-context defect) or the respawn was ignored. Classification
     *  is the shared shell-classifier PLUS the basename of the shell this launcher itself selected
     *  (r2-B1: a configured tcsh/csh — or any configured default shell — is a valid blank; a
     *  hard-coded set here false-refused AFTER the destructive cutover). One bounded retry absorbs
     *  shell spawn latency; a null probe counts as unverified (refuse, never assume). */
    private verifyPaneIsBlankShell;
    /**
     * Composer unwind for a successor that launched but failed downstream (context delivery or continuity
     * verify). CUTOVER INVARIANT: the successor occupies the retiree's PRESERVED pane, so cleanup NEVER
     * kills the session — that would destroy the seat's recoverable state. It only marks the discovery
     * candidate vanished; the re-wakeable shell stays in the pane and the seat is recoverable from its
     * provider session file. (`tmuxSession` is retained for signature stability + call-site logging.)
     */
    cleanup(_tmuxSession: string, discoveredId: string | null): Promise<void>;
}
//# sourceMappingURL=successor-session-launcher.d.ts.map