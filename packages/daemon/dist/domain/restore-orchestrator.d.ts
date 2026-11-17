import type Database from "better-sqlite3";
import type { RigRepository } from "./rig-repository.js";
import { type SessionRegistry } from "./session-registry.js";
import type { EventBus } from "./event-bus.js";
import type { SnapshotRepository } from "./snapshot-repository.js";
import type { SnapshotCapture } from "./snapshot-capture.js";
import type { CheckpointStore } from "./checkpoint-store.js";
import type { NodeLauncher } from "./node-launcher.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { ClaudeResumeAdapter } from "../adapters/claude-resume.js";
import type { CodexResumeAdapter } from "../adapters/codex-resume.js";
import type { PiResumeAdapter } from "../adapters/pi-resume.js";
import type { OmpResumeAdapter } from "../adapters/omp-resume.js";
import type { TranscriptStore } from "./transcript-store.js";
import type { RestoreOutcome, RestoreRigResult, RestoreNodeResult, SnapshotData, RestoreSnapshotSelection, RestoreValidationBlocker } from "./types.js";
import { resolveSnapshotRestoreTopology } from "./restore-topology.js";
export type ReconcileNodeResult = {
    ok: true;
    attemptId: number;
    from: "failed" | "attention_required";
    to: "operator_recovered";
    evidence: {
        tmux: boolean;
        fgProcess: "claude" | "codex" | string;
        resumeTokenUsed: boolean;
        paneState: "usable";
    };
} | {
    ok: false;
    code: "node_not_found" | "no_attempt" | "outcome_not_upgradable" | "tmux_session_missing" | "binding_mismatch" | "process_lineage_mismatch" | "fg_process_not_runtime" | "resume_token_not_used" | "pane_not_usable";
    detail: string;
};
export { resolveActiveSnapshotSession } from "./active-occupant.js";
export type { ActiveSnapshotSessionResolution } from "./active-occupant.js";
export type RestorePreflightClassification = {
    live: string[];
    stale: string[];
    unknown: string[];
};
export type RestorePreflightOutcome = {
    ok: true;
    classification: RestorePreflightClassification;
    validation: {
        blockers: RestoreValidationBlocker[];
        warnings: string[];
    };
    topology: ReturnType<typeof resolveSnapshotRestoreTopology>;
} | {
    ok: false;
    code: "rig_not_stopped";
    message: string;
} | {
    ok: false;
    code: "pre_restore_validation_failed";
    message: string;
    validation: {
        blockers: RestoreValidationBlocker[];
        warnings: string[];
    };
    topology: ReturnType<typeof resolveSnapshotRestoreTopology>;
};
export declare function rollupRestoreRigResult(nodes: RestoreNodeResult[]): RestoreRigResult;
/** OPR.0.4.3.20 FR-7 — restore/launch statuses that mean NO session is running and
 *  the operator must act. The launch API + CLI must NOT report these as a successful
 *  launch (a subset/single launch that lands `awaiting-decision` is not "Launched"). */
export declare const NON_RUNNING_LAUNCH_STATUSES: ReadonlySet<string>;
/** True when a restore/launch status means a session is actually running (a real
 *  successful launch): resumed / rebuilt / fresh / fresh-primed / operator_recovered. */
export declare function launchStatusIsRunning(status: string): boolean;
export interface NarrowLaunchResult {
    ok: boolean;
    planOnly?: boolean;
    code?: string;
    message?: string;
    launched?: RestoreNodeResult[];
    held?: Array<{
        nodeId: string;
        logicalId: string;
        reason: string;
    }>;
    alreadyRunning?: Array<{
        nodeId: string;
        logicalId: string;
    }>;
    failedTargets?: Array<{
        nodeId: string;
        logicalId: string;
        reason: string;
    }>;
    targetNodes?: Array<{
        nodeId: string;
        logicalId: string;
    }>;
    unmatchedIds?: string[];
    warnings?: string[];
    snapshotSelection?: RestoreSnapshotSelection;
    nonTargetEffects?: {
        mode: "unchanged" | "detach_and_hold";
        reason: string | null;
        affected: Array<{
            nodeId: string;
            logicalId: string;
            reason: string;
        }>;
        condition?: string;
    };
}
interface RestoreOrchestratorDeps {
    db: Database.Database;
    rigRepo: RigRepository;
    sessionRegistry: SessionRegistry;
    eventBus: EventBus;
    snapshotRepo: SnapshotRepository;
    snapshotCapture: SnapshotCapture;
    checkpointStore: CheckpointStore;
    nodeLauncher: NodeLauncher;
    tmuxAdapter: TmuxAdapter;
    claudeResume: ClaudeResumeAdapter;
    codexResume: CodexResumeAdapter;
    /** OPR.0.4.6.PI1 FR-6 — optional so older wiring/tests keep working; a Pi
     *  resume without the adapter falls through to the honest no-adapter error. */
    piResume?: PiResumeAdapter;
    ompResume?: OmpResumeAdapter;
    transcriptStore?: TranscriptStore;
    serviceOrchestrator?: import("./service-orchestrator.js").ServiceOrchestrator;
    listProcesses?: () => Promise<Array<{
        pid: number;
        ppid: number;
        command: string;
    }>>;
}
export declare class RestoreOrchestrator {
    readonly db: Database.Database;
    private activeRestores;
    private rigRepo;
    private sessionRegistry;
    private eventBus;
    private snapshotRepo;
    private snapshotCapture;
    private nodeLauncher;
    private tmuxAdapter;
    private claudeResume;
    private codexResume;
    private piResume;
    private ompResume;
    private transcriptStore;
    private serviceOrchestrator;
    private listProcesses;
    private appliedLaunchStore;
    constructor(deps: RestoreOrchestratorDeps);
    /**
     * Read-only restore preflight: classify DB-running sessions against tmux and
     * run the same structural `validatePreRestore` used by restore(), without
     * capturing a snapshot or mutating a session. Auto-rehydrate routes call this
     * on the prepared payload BEFORE persisting the capture.
     */
    preflightSnapshotData(snapshotData: SnapshotData, opts?: {
        fsOps?: {
            exists(path: string): boolean;
        };
        freshLogicalIds?: string[];
    }): Promise<RestorePreflightOutcome>;
    restore(snapshotId: string, opts?: {
        adapters?: Record<string, import("./runtime-adapter.js").RuntimeAdapter>;
        fsOps?: {
            exists(path: string): boolean;
        };
        /**
         * OPR.0.3.4.2 — operation B opt-in: logical ids the operator explicitly
         * asked to fresh-prime (`rig up --existing <rig> --fresh <seat...>`).
         * Listed seats skip the resume attempt and launch a deliberate
         * blank-slate session, reported as `fresh-primed`. Unlisted unresumable
         * resume-policy seats STOP as `awaiting-decision` instead.
         */
        freshLogicalIds?: string[];
        /** Explicit rig launch choice; persisted only after restore preconditions pass. */
        nonInterruptive?: boolean;
        /** Selection evidence from an automatic caller. Direct restore defaults
         * to explicit because its public door names the snapshot id. */
        snapshotSelection?: RestoreSnapshotSelection;
        /**
         * L3: fired with the persisted `restore.started` event seq as soon as the
         * orchestrator commits to running per-node restore. Routes use this to
         * return `attemptId` to the client immediately while per-node work
         * continues in the background.
         */
        onAttemptStarted?: (attemptId: number) => void;
    }): Promise<RestoreOutcome>;
    launchNodeSubset(rigId: string, logicalIds: string[], opts?: {
        adapters?: Record<string, import("./runtime-adapter.js").RuntimeAdapter>;
        fsOps?: {
            exists(path: string): boolean;
        };
        holdReason?: string;
        snapshotId?: string;
    }): Promise<NarrowLaunchResult>;
    planNodeSubset(rigId: string, logicalIds: string[], opts?: {
        holdReason?: string;
        snapshotId?: string;
        nonTargetMode?: "unchanged" | "detach_and_hold";
    }): NarrowLaunchResult;
    launchSingleNode(rigId: string, logicalId: string, opts?: {
        adapters?: Record<string, import("./runtime-adapter.js").RuntimeAdapter>;
        fsOps?: {
            exists(path: string): boolean;
        };
        snapshotId?: string;
    }): Promise<NarrowLaunchResult>;
    private launchNodeTargets;
    private captureNodeState;
    /**
     * Classify ALL DB-running sessions against tmux reality without mutating DB.
     * Scans every session (not just latest-per-node) to catch older live sessions
     * behind newer detached rows. Returns structured classification for the caller
     * to act on: live sessions block restore, stale sessions get marked detached
     * AFTER the pre_restore snapshot is captured, unknown sessions fail closed.
     */
    private classifyRunningSessions;
    private clearStaleState;
    private restoreNodeState;
    private computeRestorePlan;
    /**
     * Restore one planned seat, checking continuity before launching its occupant.
     * Preserve prior state so a failed launch or resume can be compensated.
     */
    private restoreNodeWithCompensation;
    /** A seat that came back running should also have its role, culture and SOP guidance. If its
     *  guidance file still lacks a managed block it should hold, the seat keeps its true status (a
     *  live resumed session is still running) and the gap is disclosed on the node and in the
     *  warnings, so the rig is reported partially_restored, not fully_restored. */
    private checkRestoredGuidance;
    /** OPR.0.3.4.2 (B) — roll a just-launched session back to ZERO sessions for
     *  the awaiting-decision outcome: kill the live blank session, mark its row
     *  superseded, and restore the prior binding/session state (the existing
     *  launch-failure compensating action). The caller fires this ONLY on a
     *  POSITIVE determination the session is fresh/blank — never for
     *  unknown-but-possibly-valid continuity. */
    private rollbackToZeroSession;
    private postLaunchRestore;
    /** A native resume is only a full success after the restored terminal is
     * rebound and its process identity agrees with the declared seat runtime. */
    private finishJoinedResume;
    private launchedSessionMatchesSnapshotResume;
    /**
     * OPR.0.4.8.3 Seam B — a restored seat's launch posture WITHOUT the in-memory RigSpec
     * (dev-guard restart-provenance ruling):
     *   1. Persisted node provenance (migration 057) is the primary source. For a CUSTOM
     *      attachment with readable provenance (declaringDir + the node's raw ref) the policy
     *      is REOPENED + re-derived (a custom surface:flag policy restores to full_bypass);
     *      an unreadable file degrades to the PERSISTED posture (still restart-stable).
     *   2. No provenance (e.g. organic claim/self-attach seats): the persisted RIG-level ref
     *      resolves — builtin refs resolve dirlessly; a custom rig ref without provenance
     *      degrades to the resolver's advisory floor (honest absence of a declaring dir).
     *   3. Nothing attached (or a resolution error) → EXPLICIT "floor" — the locked
     *      minimum-floor absence contract; never undefined/env-delegation for managed seats.
     */
    private resolveRestorePosture;
    private attemptResume;
    /**
     * L3 Decision 3: runtime-truth reconciliation. Given a node whose original
     * `restoreOutcome` was `failed` or `attention_required`, examine current
     * runtime state. If ALL four visible-evidence preconditions hold, append
     * `restore.outcome_reconciled` so the node's effective post-reconciliation
     * outcome becomes `operator_recovered`. Never mutates or deletes the
     * original failure event; never produces `ready`.
     *
     * Returns `{ ok: true, attemptId, from, to, evidence }` on upgrade, or
     * `{ ok: false, code, detail }` describing exactly which precondition
     * failed (or "no_attempt" / "outcome_not_upgradable" when there is nothing
     * to reconcile).
     */
    reconcileNodeRuntimeTruth(rigId: string, nodeId: string): Promise<ReconcileNodeResult>;
    private writeCheckpointFile;
}
//# sourceMappingURL=restore-orchestrator.d.ts.map