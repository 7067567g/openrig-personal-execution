import type Database from "better-sqlite3";
import type { RigRepository } from "./rig-repository.js";
import type { SessionRegistry } from "./session-registry.js";
import type { DiscoveryRepository } from "./discovery-repository.js";
import type { EventBus } from "./event-bus.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { TmuxOptionDefaultsApplier } from "./tmux-option-defaults.js";
import { type SeatStatusResult } from "./seat-status-service.js";
import { type SeatHandoverPlan, type SeatHandoverSource } from "./seat-handover-planner.js";
import { SuccessorSessionLauncher } from "./successor-session-launcher.js";
import { type ResumeTokenCaptureDeps } from "./resume-token-capture.js";
import type { RuntimeAdapter } from "./runtime-adapter.js";
import type { OccupantInvalidator } from "./occupant-invalidator.js";
import type { JsonlExchange } from "./session-jsonl.js";
/** A bounded labeled-from-record recap of the predecessor's last exchanges + the record path,
 *  resolved from the predecessor's provider transcript (claude transcript_path / codex rollout_path).
 *  The permanent claude-runtime leg of scrollback preservation (alternate-screen seats keep no
 *  native scrollback); renders on codex seats too, where native scrollback is the money proof. */
export interface PredecessorRecap {
    recap: JsonlExchange[];
    recordPath: string;
}
/** B16 — every no-recap outcome is NAMED: the resolver returns either the recap or the reason it
 *  is unavailable, and the packet prints that reason (honest-degraded means labeled, not silent). */
export type PredecessorRecapResolution = PredecessorRecap | {
    unavailableReason: string;
};
/** Resolve the predecessor's bounded recap for the successor boot packet, or a named unavailable
 *  verdict (never a silent null — the packet renders the reason). */
export type PredecessorRecapResolver = (args: {
    nodeId: string;
    runtime: string | null;
    sessionName: string;
}) => PredecessorRecapResolution;
export interface SeatHandoverMutationResult {
    ok: true;
    dryRun: false;
    mutated: true;
    continuityTransferred: false;
    seat: SeatHandoverPlan["seat"];
    source: SeatHandoverSource;
    reason: string;
    operator: string | null;
    previousOccupant: string;
    currentOccupant: string;
    previousSessionIdsSuperseded: string[];
    newSessionId: string;
    discovery: {
        id: string;
        status: "claimed";
        tmuxSession: string;
        tmuxPane: string | null;
    };
    currentStatus: SeatHandoverPlan["currentStatus"];
    handoverAt: string;
    eventSeq: number;
    sideEffects: {
        departingSessionKilled: false;
        startupContextDelivered: boolean;
        provenanceRecordWritten: false;
    };
    /** OPR.0.5.5.5 — per-source execution outcome. fork: the resolved fork origin;
     *  rebuild: EXACTLY which durable artifacts primed the successor, which
     *  declared addresses were gaps, and (when the chain is empty) the named
     *  reason — recorded, never silently dropped. Absent for fresh/discovered. */
    sourceOutcome?: {
        mode: "fork";
        forkedFrom: string;
        forkId?: "captured" | "pending";
        limit?: string;
    } | {
        mode: "rebuild";
        primedArtifacts: Array<{
            address: string;
            label: string;
        }>;
        gaps: string[];
        emptyChainReason?: string;
    };
}
export type SeatHandoverResult = {
    ok: true;
    plan: SeatHandoverPlan;
} | {
    ok: true;
    result: SeatHandoverMutationResult;
} | {
    ok: false;
    code: "missing_reason" | "invalid_source" | "successor_creation_not_implemented" | "source_not_supported" | "resume_token_unavailable" | "fork_source_not_found";
    message: string;
    guidance: string;
} | {
    ok: false;
    code: "current_occupant_required" | "discovered_not_active" | "successor_tmux_absent" | "successor_already_managed" | "successor_is_current" | "runtime_mismatch";
    message: string;
    guidance: string;
} | {
    ok: false;
    code: "discovered_not_found";
    message: string;
    guidance: string;
} | {
    ok: false;
    code: "tmux_probe_failed" | "handover_commit_failed" | "successor_create_failed" | "context_delivery_failed";
    message: string;
    guidance: string;
} | Extract<SeatStatusResult, {
    ok: false;
}>;
interface SeatHandoverServiceDeps {
    db: Database.Database;
    rigRepo: RigRepository;
    sessionRegistry: SessionRegistry;
    discoveryRepo: DiscoveryRepository;
    eventBus: EventBus;
    tmuxAdapter: TmuxAdapter;
    successorLauncher?: SuccessorSessionLauncher;
    now?: () => Date;
    /** OpenRig identity/activity env stamped onto a created successor session,
     *  mirroring the launch identity env. Defaults to {} (the three core identity
     *  vars are always derived internally). */
    sessionEnv?: Record<string, string | undefined>;
    /** Extra env for one runtime only (OMP's provider keys), merged over sessionEnv. */
    runtimeSessionEnv?: Record<string, Record<string, string | undefined>>;
    /** Where the daemon vendors its plugins; default is `plugins` under the OpenRig home (tests). */
    pluginsDir?: string;
    /** Injectable id source for the successor session name (tests). */
    newSuccessorId?: () => string;
    /** Runtime adapters keyed by runtime — used to launch a fresh successor into
     *  a LIVE agent (B1) before commit. Absent → fresh handover cannot launch. */
    runtimeAdapters?: Record<string, RuntimeAdapter>;
    /** Claude sidecar reader for discovered-mode resume-token capture (B2). */
    contextUsageStore?: ResumeTokenCaptureDeps["contextUsageStore"];
    /** #421 — start time of the pane's current Claude process; a sidecar sampled earlier is skipped. */
    claudeProcessStartedAt?: ResumeTokenCaptureDeps["claudeProcessStartedAt"];
    /** Codex thread-id capturer for discovered-mode resume-token capture (B2). */
    resumeTokenCapturer?: ResumeTokenCaptureDeps["resumeTokenCapturer"];
    /** OPR.0.4.6.PI1 FR-6 — pi-runner sidecar reader for Pi resume-token capture. */
    piRunnerStateStore?: ResumeTokenCaptureDeps["piRunnerStateStore"];
    /** OMP runner sidecar reader for independently isolated OMP seats. */
    ompRunnerStateStore?: ResumeTokenCaptureDeps["ompRunnerStateStore"];
    /** Readiness timeout for the successor launch (tests shorten it). */
    readinessTimeoutMs?: number;
    /** Injectable sleep for the successor readiness backoff (tests). */
    sleep?: (ms: number) => Promise<void>;
    /**
     * OPR.0.4.6.02 S1 — the SHARED tmux option-defaults applier, threaded into
     * the successor launcher so a FRESH handover successor gets the same
     * mouse/status/clipboard defaults as a NodeLauncher-launched seat.
     */
    tmuxOptionDefaults?: TmuxOptionDefaultsApplier;
    /**
     * Ghost-stage (e) seam — the per-store retiring-occupant invalidator, authored by the ghost-stage
     * slice and CALLED once at commit() so the cutover successor never inherits a predecessor's seat-name-
     * keyed state. Optional: absent until the ghost-stage slice lands → the commit call is skipped (never
     * blocking the handover). See occupant-invalidator.ts.
     */
    occupantInvalidator?: OccupantInvalidator;
    /**
     * Resolves the predecessor's bounded from-record recap for the successor boot packet (claude
     * transcript_path / codex rollout_path → parseJsonlExchanges). Optional: absent → the recap
     * sections are omitted honestly. The recap is the permanent claude-runtime leg of scrollback
     * preservation (alternate-screen seats keep no native scrollback); on codex seats the preserved
     * native scrollback is the money proof. Wired in production to ContextUsageStore + parseJsonlExchanges.
     */
    predecessorRecapResolver?: PredecessorRecapResolver;
    /**
     * OPR.0.5.3.5 mini-req 7 — resolves the AUTHORED seat recap (RECAP.md beside LEARNED, written by
     * the outgoing occupant) for the successor packet's pointer leg. Optional: absent -> the authored
     * leg is omitted (the feature never ran); a resolver that finds nothing returns the labeled
     * absence. Wired in production to seat-recap-store + the topology.root seat layout.
     */
    authoredRecapResolver?: (seatRef: string) => {
        address: string;
        chainLength: number;
    } | {
        absentReason: string;
    };
    /**
     * S19 (territory ruling qitem-20260827001530, EXACT bounds): ONE narrow call into the
     * activity oracle at the completion/rebind commit point so seat-keyed activity state
     * treats the cutover as its own visible event and the successor's rung inventory
     * starts unpromoted (never inheriting the retiree's rung authority). Optional: absent
     * → skipped, never blocks a handover.
     */
    activityOracle?: {
        declareOccupantSwap: (seatNodeId: string, generation: string) => void;
    };
    /**
     * OPR.0.5.5.5 — resolves the seat's durable rebuild-priming chain (authored
     * recap chain, LEARNED, restore-packet record) in trust-precedence order for
     * `--source rebuild`. Optional: absent → rebuild executes with a named empty
     * chain. Wired in production to seat-recap-store (listRecapChain) + the
     * topology.root seat layout.
     */
    rebuildPrimingResolver?: (seatRef: string) => {
        artifacts: Array<{
            address: string;
            label: string;
        }>;
    } | {
        emptyReason: string;
    };
    /** OPR.0.5.5.5 — filesystem existence check for declared rebuild artifacts
     *  (the session-source-rebuild-resolver seam). Default: node:fs existsSync;
     *  tests inject. */
    rebuildArtifactExists?: (path: string) => boolean;
}
export declare class SeatHandoverService {
    private db;
    private statusService;
    private planner;
    private rigRepo;
    private sessionRegistry;
    private discoveryRepo;
    private eventBus;
    private tmuxAdapter;
    private successorLauncher;
    private captureDeps;
    private occupantInvalidator;
    private predecessorRecapResolver;
    private authoredRecapResolver;
    private activityOracle;
    private rebuildPrimingResolver;
    private rebuildArtifactExists;
    /** Injectable sleep (tests): also carries the shared paste-then-submit settle in deliverRestorePacket. */
    private sleep;
    private appliedLaunchObservations;
    private now;
    private pluginsDir;
    constructor(deps: SeatHandoverServiceDeps);
    handover(input: {
        seatRef: string;
        reason?: string | null;
        source?: string | null;
        operator?: string | null;
        dryRun?: boolean;
    }): Promise<SeatHandoverResult>;
    /**
     * The shared discovered->commit path (validation + presence-verify + rebind).
     * `cleanup` is invoked before returning ANY failure so a composer-created
     * successor is unwound; the discovered-source caller passes null (nothing to
     * unwind). The `hasSession` probe here is the continuity/presence verify that
     * runs BEFORE the commit releases the original binding.
     */
    private finalizeWithDiscovered;
    /**
     * B2 — best-effort discovered-mode resume-token capture at commit. Derives the
     * live token via the shared FR-3 derive-helper (pure read), persists it with
     * provenance "adoption" (the rank guard governs clobber), and emits the same
     * captured/preserved/skipped events FR-3 uses. Honest failure = persist
     * nothing + a redacted skip event. NEVER throws, never logs the token.
     */
    private captureDiscoveredResumeToken;
    private emitCaptureSkip;
    /** Best-effort capture of the departing seat's visible terminal before the
     *  successor is created. Never throws; an empty capture is honestly recorded
     *  as "no capture available" in the restore packet. */
    private captureDepartingContext;
    /** OPR.0.5.5.5 — deliver the rebuild priming packet through the same shipped
     *  interactive-text transport as the restore packet. The packet points the
     *  successor at the durable artifacts (it reads them itself) and names every
     *  gap and an empty chain out loud — never a silent partial priming. */
    private deliverRebuildPrimingPacket;
    /** Deliver the captured restore packet to a fresh successor via the shipped
     *  interactive-text transport (send_text + Enter), mirroring the startup
     *  orchestrator's initial-prompt delivery. */
    private deliverRestorePacket;
    private checkRuntimeMismatch;
    private lookupNode;
    private lookupLatestSession;
    private lookupManagedOwner;
    private commit;
    private upsertBinding;
}
/** Assemble the restore packet delivered to a fresh successor: seat identity + handover reason +
 *  predecessor session + the captured predecessor terminal, and a bounded LABELED-FROM-RECORD recap
 *  of the last few predecessor exchanges + a receipt line naming the predecessor record path
 *  (honest-degraded). The recap is the permanent claude-runtime leg of scrollback preservation —
 *  claude-code seats run in the tmux alternate screen, which keeps no scrollback buffer, so no
 *  successor pane can natively scroll into the predecessor conversation there; the cutover's
 *  respawn-pane owns native scrollback on codex seats. Never called "scrollback": the label must
 *  make replay unmistakable, because passing a replayed recap off as native history is the one
 *  thing the requirement cannot survive. Exported for unit test. */
export declare function buildRestorePacket(info: {
    seatRef: string;
    reason: string;
    departingSession: string;
    handoverAt: string;
    capturedContext: string;
    /** The last few predecessor exchanges read from the provider JSONL, bounded on count and per-exchange length. */
    recap?: Array<{
        role: string;
        content: string;
    }>;
    /** The predecessor provider record path (claude transcript_path / codex rollout_path). */
    recordPath?: string | null;
    /** B16 — the NAMED reason when no recap resolved; rendered as its own labeled line so the absence
     *  is visible in the pane (honest-degraded means labeled, not silent). */
    recapUnavailableReason?: string;
    /** OPR.0.5.3.5 mini-req 7 — the AUTHORED seat recap (decisions-with-rationale, written by the
     *  outgoing occupant): rendered as a POINTER to its address (no-copy composition — the packet
     *  never inlines the bytes; the successor pulls by address). */
    authoredRecap?: {
        address: string;
        chainLength: number;
    };
    /** Labeled absence for the authored leg (B16 doctrine — never a silent omission). */
    authoredRecapAbsentReason?: string;
}): string;
export {};
//# sourceMappingURL=seat-handover-service.d.ts.map