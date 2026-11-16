import type Database from "better-sqlite3";
import type { SessionRegistry } from "./session-registry.js";
import type { EventBus } from "./event-bus.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { StartupAction, StartupFailureStage } from "./types.js";
import type { RuntimeAdapter, NodeBinding, ResolvedStartupFile, ForkSource } from "./runtime-adapter.js";
import type { ProjectionPlan } from "./projection-planner.js";
import { type StartupSubmissionDiagnostic } from "./startup-submission-evidence.js";
import { SettingsStore } from "./user-settings/settings-store.js";
import { type NativeProcessLister } from "./native-process-lineage.js";
/** Pending context belongs to this occupant and is consumed before delivery starts. */
export declare function hasPendingFreshStartup(db: Database.Database, nodeId: string, sessionId: string): boolean;
export declare function hasClaudeResumeIdentityWork(sessionRegistry: SessionRegistry, sessionId: string, runtime: string | undefined, resumeToken: string | undefined | null, resumeType: string | undefined | null, skipHarnessLaunch?: boolean, continuityOutcome?: string): boolean;
export declare function hasPendingStartupWork(db: Database.Database, nodeId: string, sessionId: string): boolean;
export declare function getLatestStartupFailedEvent(db: Database.Database, nodeId: string, sessionId: string): {
    type: string;
    sessionId?: string;
    freshContextPending?: boolean;
    hasPendingWork?: boolean;
    stage?: StartupFailureStage;
    requestedResumeToken?: string | null;
    requestedResumeType?: string | null;
} | null;
export declare function isRecoverableStartupFailure(db: Database.Database, nodeId: string, sessionId: string): boolean;
export interface StartupInput {
    rigId: string;
    nodeId: string;
    sessionId: string;
    binding: NodeBinding;
    adapter: RuntimeAdapter;
    plan: ProjectionPlan;
    resolvedStartupFiles: ResolvedStartupFile[];
    startupActions: StartupAction[];
    isRestore: boolean;
    /** Session name for harness launch (used as --name flag). */
    sessionName?: string;
    /** Resume token for restore path. Mutually exclusive with forkSource. */
    resumeToken?: string;
    /** Runtime-native type for resumeToken (for example claude_id or codex_id). */
    resumeType?: string;
    /**
     * Fork-source for new-seat-from-prior-conversation path. Mutually
     * exclusive with resumeToken. v1: kind="native_id" only. The captured
     * post-fork token (returned by the adapter) is what gets persisted on
     * the new seat — the parent token is NEVER persisted.
     */
    forkSource?: ForkSource;
    /**
     * Rebuild-mode artifact set (operator-declared via
     * `session_source.mode: rebuild`). When set, the orchestrator merges
     * these artifacts into the post-launch delivery path, fresh-launches
     * the harness with NO `resumeToken` and NO `forkSource`, and records
     * `continuityOutcome: "rebuilt"` on the seat. NEVER paired with
     * `resumeToken` or `forkSource` — rebuild is a distinct creation path.
     */
    rebuildArtifacts?: ResolvedStartupFile[];
    /** Skip harness launch (legacy nodes that already resumed via old helpers). */
    skipHarnessLaunch?: boolean;
    /** Allow runtime adapter retry_fresh fallback when native resume data is stale. */
    allowFreshFallback?: boolean;
    /** Exact resume preserves saved context; its empty Claude plan must not disable activity hooks. */
    preserveStartupContext?: boolean;
    /** Continue the same fresh occupant after a prerequisite, without another harness launch. */
    continueFreshStartup?: boolean;
    /** Deliberate fresh replacement retains the seat’s durable destination obligations. */
    includeDurableObligations?: boolean;
    /** Readiness timeout in ms (defaults to runtime.readiness_timeout_seconds). */
    readinessTimeoutMs?: number;
}
export type StartupResult = {
    warnings?: string[];
} & ({
    ok: true;
    startupStatus: "ready";
    continuityOutcome: "resumed" | "fresh" | "forked" | "rebuilt";
    submission?: {
        status: "unverified" | "staged";
        reasons: string[];
        warning?: string;
        diagnostics?: StartupSubmissionDiagnostic[];
    };
} | {
    ok: false;
    startupStatus: "attention_required" | "failed";
    errors: string[];
    evidence?: string;
    recovery?: string;
    missingConversation?: true;
});
interface StartupOrchestratorDeps {
    db: Database.Database;
    sessionRegistry: SessionRegistry;
    eventBus: EventBus;
    tmuxAdapter: TmuxAdapter;
    /** Read file content for concrete-hint resolution. */
    readFile?: (path: string) => string;
    /** Sleep between paste and submit for tmux-driven TUIs. */
    sleep?: (ms: number) => Promise<void>;
    readinessSettings?: Pick<SettingsStore, "resolveOne">;
    /** Process observation for a Claude resume launch's own record of its process (#1077). */
    listProcesses?: NativeProcessLister;
}
/**
 * Drives one node from projected resources to startup_status: ready.
 *
 * Sequence (NS-T05):
 * 1. Mark pending, emit node.startup_pending
 * 2. Project resources (filesystem)
 * 3. Deliver pre-launch files (guidance_merge, skill_install → filesystem)
 * 4. Launch harness via adapter.launchHarness()
 * 5. Wait for harness ready (retry with exponential backoff, configurable timeout)
 * 6. For fresh sessions, inject the built-in identity anchor as the first prompt
 *    and deliver remaining post-launch files (send_text → TUI)
 * 7. Execute after_files actions
 * 8. Execute after_ready actions
 * 9. Persist startup context + resume token
 * 10. Mark ready, emit node.startup_ready
 *
 * Failure leaves startup_status: failed, node visible.
 * The caller creates session + binding first via NodeLauncher,
 * then calls startNode() with the full startup payload.
 */
export declare class StartupOrchestrator {
    readonly db: Database.Database;
    private sessionRegistry;
    private eventBus;
    private tmuxAdapter;
    private sleep;
    private appliedLaunchStore;
    private sessionTransport;
    private readinessSettings;
    private listProcesses;
    constructor(deps: StartupOrchestratorDeps);
    private readFile;
    /** The process this Claude resume launch started, as the launch itself observes it (#1077): the one
     *  the adapter's readiness check pinned first, else one observed now. A rotation its hook later
     *  reports counts only for this process; unobserved, none counts. */
    private recordClaudeResumeLaunch;
    startNode(input: StartupInput): Promise<StartupResult>;
    private startNodeWithWarnings;
    /** A failed attempt can continue only when it stopped before sending context.
     * Any newer pending/ready/failure event consumes that permission, including a
     * daemon loss during delivery: uncertain delivery is never blindly replayed.
     */
    canContinueFresh(nodeId: string, sessionId: string): boolean;
    /**
     * Wait for harness readiness with exponential backoff.
     * Backoff: 1s → 2s → 4s → 8s → 16s (capped); the caller supplies the deadline.
     */
    private waitForReady;
    private safeReadFile;
    private fail;
    private executeActions;
    private extractSessionIdentityAction;
    private deliverInitialSessionPrompt;
    /**
     * OPR.0.4.7.17 restore-order-correction. Deliver the after_ready send_text
     * preload action(s) as the single leading turn on a resumed restore, bundling
     * the first work-triggering send_text post-launch file (guidance/role.md)
     * behind them so "load skills BEFORE anything else" causally precedes the role
     * content in one submission. Returns the post-launch files still to deliver
     * normally (role.md removed once bundled).
     */
    private deliverRestorePreloadPrompt;
    /**
     * Claude only: the challenge reached the seat inside a paste, which Claude won't act on alone.
     * One short line in the person's turn asks it to run the challenge's own command. Best-effort: a
     * failed send is a submission warning, never a startup failure. It is sent only after the startup
     * prompt was observed submitted: staged, unverified or unobservable input stays in the composer
     * for the operator, and nothing is typed on top of it.
     */
    private sendProofInstruction;
    private recordSubmissionWarning;
    private sendInteractiveText;
    /**
     * Claude can take the startup Enter after the first look while the composer still shows our paste collapsed.
     * Only that transient is looked at again, until the composer reads clear or staged, shows anything else, or
     * the looks run out. A draft, ghost text or any other mismatch keeps its first-look verdict. Observation only.
     * Remaining ambiguity: a person who clears a collapsed paste with the same line count inside the window reads
     * as submitted.
     */
    private settleOwnPaste;
}
export {};
//# sourceMappingURL=startup-orchestrator.d.ts.map