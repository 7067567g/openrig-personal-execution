import type Database from "better-sqlite3";
import type { RigRepository } from "./rig-repository.js";
import type { SessionRegistry } from "./session-registry.js";
import type { DiscoveryRepository } from "./discovery-repository.js";
import type { EventBus } from "./event-bus.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { TranscriptStore } from "./transcript-store.js";
import { type ResumeTokenCaptureDeps } from "./resume-token-capture.js";
import { type NativeProcessLister } from "./native-process-lineage.js";
export type ClaimResult = {
    ok: true;
    nodeId: string;
    sessionId: string;
} | {
    ok: false;
    code: string;
    error: string;
};
/**
 * OPR.0.3.4.3 — outcome of the no-launch reconcile (adopt a hand-resumed
 * canonical session back into its persisted node). Honest split: `projectionDrift`
 * lists topology metadata the reconcile could NOT prove about the live pane;
 * `continuity` is ALWAYS "unverified" — reconnecting the projection never claims
 * the provider conversation is continuous.
 */
export interface ReconcileSessionResult {
    rigId: string;
    rigName: string;
    nodeId: string;
    logicalId: string;
    sessionName: string;
    sessionId: string;
    /** Topology metadata the reconcile could not prove on the live pane (e.g.
     *  "runtime unverified: pane command 'node' does not confirm runtime 'codex'"). */
    projectionDrift: string[];
    /** Provider-session conversation continuity is never verified by reconcile. */
    continuity: "unverified";
}
export type ReconcileSessionOutcome = {
    ok: true;
    result: ReconcileSessionResult;
} | {
    ok: false;
    code: "session_not_found";
    message: string;
} | {
    ok: false;
    code: "node_not_found";
    message: string;
} | {
    ok: false;
    code: "rig_not_found";
    message: string;
} | {
    ok: false;
    code: "node_mismatch";
    message: string;
} | {
    ok: false;
    code: "reconcile_error";
    message: string;
};
export interface ReconcileSessionOptions {
    sessionName: string;
    /** Optional explicit disambiguation; when given they are authoritative and
     *  cross-checked against the session-name mapping. */
    rigId?: string;
    logicalId?: string;
}
interface ClaimServiceDeps {
    db: Database.Database;
    rigRepo: RigRepository;
    sessionRegistry: SessionRegistry;
    discoveryRepo: DiscoveryRepository;
    eventBus: EventBus;
    tmuxAdapter?: TmuxAdapter;
    transcriptStore?: TranscriptStore;
    claudeContextProvisioner?: {
        ensureContextCollector(binding: {
            cwd?: string | null;
            tmuxSession?: string | null;
        }): void;
    };
    contextUsageStore?: {
        readSidecar(sessionName: string): {
            ok: true;
            data: {
                session_id?: string;
                sampled_at?: string;
            };
        } | {
            ok: false;
            reason: string;
        };
    };
    /** #421 — start time of the pane's current Claude process; a sidecar sampled earlier is skipped. */
    claudeProcessStartedAt?: ResumeTokenCaptureDeps["claudeProcessStartedAt"];
    /** Process census for the runtime proof in `reconcileSession`; defaults to the live process table. */
    listProcesses?: NativeProcessLister;
    resumeTokenCapturer?: {
        captureCodexThreadId(sessionName: string): Promise<string | undefined>;
    };
    /** OPR.0.4.6.PI1 FR-6 — pi-runner sidecar reader for Pi resume-token capture. */
    piRunnerStateStore?: {
        readSessionFile(sessionName: string): {
            ok: true;
            sessionFile: string;
        } | {
            ok: false;
            reason: string;
        };
    };
    ompRunnerStateStore?: ResumeTokenCaptureDeps["ompRunnerStateStore"];
}
interface BindOptions {
    discoveredId: string;
    rigId: string;
    logicalId: string;
}
interface CreateAndBindToPodOptions {
    discoveredId: string;
    rigId: string;
    podId: string;
    podNamespace: string;
    memberName: string;
}
/**
 * Adopts a discovered session into a managed rig.
 * Creates node + binding + session record atomically.
 * No package install, no guidance merge, no hooks.
 */
export declare class ClaimService {
    readonly db: Database.Database;
    private rigRepo;
    private sessionRegistry;
    private discoveryRepo;
    private eventBus;
    private tmuxAdapter;
    private transcriptStore;
    private claudeContextProvisioner;
    private contextUsageStore;
    private claudeProcessStartedAt;
    private listProcesses;
    private resumeTokenCapturer;
    private piRunnerStateStore;
    private ompRunnerStateStore;
    constructor(deps: ClaimServiceDeps);
    private observeBindingPane;
    private persistPaneBinding;
    /** Best-effort: set OpenRig-owned tmux metadata on an adopted session. */
    private setRiggedMetadata;
    /** Best-effort: send a short identity hint into the adopted session after claim. */
    private deliverClaimHint;
    private maybeProvisionContextCollector;
    /**
     * OPR.0.4.3.20 FR-3 — best-effort capture of a seat's resume token at the
     * adoption boundary (reconcile / adopt / bind). Called post-tx, pre-return
     * from all three ClaimService adoption paths, precisely where an operator has
     * just re-established a live session they expect to survive the next crash.
     *
     * Derivation is REUSE-ONLY and PURE READ — no pane writes, no launch — so it
     * is consistent with reconcile's no-launch/no-input safety contract:
     *   claude-code → the status-line sidecar's session_id (a file read)
     *   codex       → the thread id derived from live pid-keyed logs
     * Persist via updateResumeToken with provenance "adoption"; the rank guard
     * governs clobber (operator/hook are never downgraded; the validity guard
     * blocks an empty write). Honest failure = persist nothing (null token = the
     * honest missing/unverified state) + a redacted skip event with a stated
     * reason. Terminal/unknown runtime is exempt (no capture, no event, not a
     * failure). ANY throw is swallowed — capture NEVER fails or blocks the
     * adoption (PRD Rule 7).
     */
    private captureResumeTokenOnAdoption;
    private emitCaptureSkip;
    bind(opts: BindOptions): Promise<ClaimResult>;
    /** Whether the pane's own process tree shows the node's runtime, whatever `pane_current_command` says. */
    private runtimeProvenInPane;
    /**
     * OPR.0.3.4.3 — no-launch reconcile: adopt a LIVE, hand-resumed canonical
     * session back into its persisted node. The safest outage repair (manual
     * `claude --resume` / `codex resume` into the canonical tmux name) leaves the
     * daemon projection showing the seat down; this binds the live process to its
     * OWN node and flips the projection, and does NOTHING else.
     *
     * THE SAFETY LINE (guard rev1): reuses ONLY the DB binding / projection /
     * metadata portions of bind — NEVER the post-claim input path. It does not
     * call launchNode / createSession / killSession / sendText / sendKeys /
     * deliverClaimHint / startup-or-resume delivery / compact-menu automation.
     * Allowed target ops: hasSession check, pane metadata/PID reads,
     * binding/session/projection upserts, non-input tmux metadata
     * (setSessionOption), event emission, transcript bookkeeping.
     *
     * Identity boundary: binds to the EXISTING node — same node id, no re-key,
     * no migration. Honest split: projectionDrift (unproven topology metadata)
     * is reported separately; continuity is always "unverified".
     */
    reconcileSession(opts: ReconcileSessionOptions): Promise<ReconcileSessionOutcome>;
    /** The session name a managed node is EXPECTED to live at — pod-aware nodes
     *  derive `{pod}-{member}@{rigName}`; legacy flat nodes use the legacy
     *  derivation. Used to fence the explicit --rig/--node reconcile branch when
     *  the daemon has no history mapping for the supplied name. */
    private expectedManagedSessionName;
    /** Map a canonical session name to its persisted node via the daemon's own
     *  history: the current binding first, then the most recent session row. */
    private resolveNodeIdForSessionName;
    createAndBindToPod(opts: CreateAndBindToPodOptions): Promise<ClaimResult>;
}
export {};
//# sourceMappingURL=claim-service.d.ts.map