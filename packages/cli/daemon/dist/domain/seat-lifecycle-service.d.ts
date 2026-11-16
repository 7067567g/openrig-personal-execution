import type { NativeProcessLister } from "./native-process-lineage.js";
import type Database from "better-sqlite3";
import type { RigRepository } from "./rig-repository.js";
import type { SessionRegistry } from "./session-registry.js";
import type { EventBus } from "./event-bus.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { NodeLauncher } from "./node-launcher.js";
import type { StartupOrchestrator } from "./startup-orchestrator.js";
import type { RuntimeAdapter } from "./runtime-adapter.js";
import type { OccupantInvalidator } from "./occupant-invalidator.js";
import type { ArbitratedSeatState } from "./activity-taxonomy.js";
import type { PaneCutoverTiming } from "./pane-cutover.js";
import { type EffortResolution, type NativeEffortObservation } from "./seat-effort.js";
import { type InPlaceRestartIo, type InPlaceRestartRefusal, type InPlaceRestartReport, type InPlaceVerifyResult } from "./seat-restart-in-place.js";
export interface SeatLifecycleDeps {
    db: Database.Database;
    rigRepo: RigRepository;
    sessionRegistry: SessionRegistry;
    eventBus: EventBus;
    tmuxAdapter: TmuxAdapter;
    listProcesses?: NativeProcessLister;
    nodeLauncher?: NodeLauncher;
    startupOrchestrator?: StartupOrchestrator;
    runtimeAdapters?: Record<string, RuntimeAdapter>;
    occupantInvalidator?: OccupantInvalidator;
    activityOracle?: {
        declareOccupantSwap(nodeId: string, generation: string): void;
        getSeatState?(nodeId: string): ArbitratedSeatState | null;
    };
    /** Test seams for the in-place restart's OS reads and stop timing; production uses the defaults. */
    inPlaceRestartIo?: Partial<InPlaceRestartIo>;
    inPlaceRestartTiming?: Partial<PaneCutoverTiming>;
    inPlaceRestartDaemonStartedAt?: Date;
    /** Where a session's native transcript is (the context-usage store); without it native effort is NOT VERIFIED. */
    transcripts?: {
        readSidecar(sessionName: string): {
            ok: true;
            data: {
                transcript_path?: string | null;
                session_id?: string | null;
            };
        } | {
            ok: false;
        };
        readCodexTranscriptPath(threadId: string): string | null;
    };
}
export interface SeatRefusal {
    ok: false;
    code: "seat_ref_required" | "seat_not_found" | "seat_ambiguous" | "missing_model" | "missing_reason" | "permission_selection_refused" | "no_session" | "claimed_session" | "session_not_live" | "session_live" | "tmux_probe_failed" | "nothing_to_clean" | "fresh_required" | "unmanaged_session_collision" | "startup_context_missing" | "startup_context_malformed" | "startup_context_runtime_mismatch" | "runtime_adapter_missing" | "launch_unavailable" | "launch_failed" | "startup_failed" | "attention_required" | "runtime_identity_unverified" | "not_codex" | "typing_guard_enabled" | "missing_effort" | "invalid_effort" | "effort_unsupported_runtime" | "effort_unavailable" | "invalid_policy";
    message: string;
    guidance?: string;
    matches?: Array<{
        rig_name: string;
        logical_id: string;
        current_occupant: string | null;
    }>;
}
export type RestartInPlaceResult = InPlaceRestartReport | InPlaceRestartRefusal | SeatRefusal;
export type VerifyRestartInPlaceResult = InPlaceVerifyResult | SeatRefusal;
export interface SeatDescriptor {
    rigId: string;
    rigName: string;
    logicalId: string;
    nodeId: string;
}
export type SetModelResult = {
    ok: true;
    seat: SeatDescriptor;
    from: string | null;
    to: string;
    changed: boolean;
} | SeatRefusal;
export type SetPolicyResult = {
    ok: true;
    seat: SeatDescriptor;
    from: string | null;
    to: string;
    launchPosture: "floor" | "full_bypass" | "auto";
    changed: boolean;
    effect: string;
} | SeatRefusal;
/** OPR.0.7.0.7 — the four effort values for one seat, kept apart. */
export interface EffortReport {
    ok: true;
    seat: SeatDescriptor;
    runtime: string;
    /** The last rig seat set-effort for this seat (null: never set, or cleared and never set since). */
    requested: {
        value: string | null;
        at: string;
        reason: string;
        operator: string | null;
    } | null;
    /** What the seat's next managed continuation sends. */
    saved: EffortResolution;
    /** The effort flag on the running process's own command line: what its launch sent. */
    emitted: {
        state: "observed";
        value: string | null;
        pid: number;
        startedAt: string | null;
        matchesSaved: boolean;
    } | {
        state: "unknown";
        detail: string;
    };
    /** What the native session recorded for a turn since that process started. */
    observed: NativeEffortObservation & {
        matchesEmitted?: boolean;
    };
    precedence: {
        decided: boolean;
        detail: string;
    };
    summary: string;
}
export type SetEffortResult = {
    ok: true;
    seat: SeatDescriptor;
    runtime: string;
    /** What was asked for: a level, or null for --clear. */
    requested: string | null;
    from: EffortResolution;
    /** What is saved now, and what the next managed continuation resolves to from it. */
    saved: EffortResolution;
    changed: boolean;
    /** Whether the seat's session is live in tmux now; unknown when the probe couldn't tell. */
    running: "yes" | "no" | "unknown";
    runningDetail?: string;
    /** Emitted at launch and observed natively are separate facts this command can't know. */
    emitted: "not_yet";
    observed: "not_observed";
    /** Set when the level isn't one the runtime is known to accept; the choice is saved anyway. */
    warning?: string;
    effect: string;
} | SeatRefusal;
export type StopSeatResult = {
    ok: true;
    seat: SeatDescriptor;
    sessionName: string;
    sessionId: string;
} | SeatRefusal;
export type CleanSeatResult = {
    ok: true;
    seat: SeatDescriptor;
    actions: {
        sessionsExited: string[];
        bindingCleared: boolean;
    };
} | SeatRefusal;
export type LaunchFreshResult = {
    ok: true;
    seat: SeatDescriptor;
    status: "ready";
    sessionName: string;
    sessionId: string;
    generation: string;
    model: string | null;
    effort?: string | null;
    startupPolicyHash: string;
    supersededSessionIds: string[];
    warnings?: string[];
} | (SeatRefusal & {
    status?: "attention_required" | "failed";
    sessionName?: string;
    sessionId?: string;
    generation?: string;
    warnings?: string[];
});
export declare class SeatLifecycleService {
    private readonly db;
    private readonly rigRepo;
    private readonly sessionRegistry;
    private readonly eventBus;
    private readonly tmuxAdapter;
    private readonly listProcesses?;
    private readonly nodeLauncher;
    private readonly startupOrchestrator;
    private readonly runtimeAdapters;
    private readonly occupantInvalidator;
    private readonly activityOracle;
    private readonly inPlaceRestartIo?;
    private readonly inPlaceRestartTiming?;
    private readonly inPlaceRestartDaemonStartedAt?;
    private readonly transcripts;
    constructor(deps: SeatLifecycleDeps);
    setModel(input: {
        seatRef: string;
        model: string;
        reason: string;
        operator?: string | null;
    }): Promise<SetModelResult>;
    /** OPR.0.7.0.7 — save one seat's effort for its next managed continuation. Like set-model it
     *  validates, writes, and persists an audited event in the same transaction; it never restarts
     *  the seat or touches its peers, model or account. `effort: null` clears the explicit choice. */
    setEffort(input: {
        seatRef: string;
        effort: string | null;
        reason: string;
        operator?: string | null;
    }): Promise<SetEffortResult>;
    /** OPR.0.7.0.7 — requested, saved, emitted at launch and observed in the native session, each from
     *  its own source. Reads only. An unseen value is reported as unknown or NOT VERIFIED, never guessed. */
    effortReport(seatRef: string): Promise<EffortReport | SeatRefusal>;
    private lastRequestedEffort;
    /** The transcript of the conversation the observed process is on, or why that join can't be made.
     *  The recorded conversation (Codex: the session's resume token; Claude: the status sidecar's session)
     *  must be the one the process itself names, by argv or, for a Codex that names none, by its own logs. */
    private joinedTranscript;
    private readEffort;
    /** Whether the seat's latest session is live now. Never a guess: an indeterminate probe is unknown. */
    private runningState;
    setPermissions(input: {
        seatRef: string;
        mode: string;
        reason: string;
        actor: string;
    }): Promise<{
        ok: true;
        seat: SeatDescriptor;
        from: unknown;
        to: unknown;
        changed: boolean;
        effect: string;
    } | SeatRefusal>;
    /** `rig policy apply <name> --seat`: re-point an existing seat's own permission_policy. This writes
     *  the raw ref and the provenance the instantiator would persist for the same member ref; restore,
     *  resume and launches that read the seat's stored state use that provenance, while a launch from a
     *  spec that declares a policy re-applies the spec's. The ref is validated exactly as a spec
     *  member's is; the running process is untouched. */
    setPolicy(input: {
        seatRef: string;
        ref: string;
        reason: string;
        actor: string;
    }): Promise<SetPolicyResult>;
    stopSeat(input: {
        seatRef: string;
        reason: string;
        operator?: string | null;
    }): Promise<StopSeatResult>;
    cleanSeat(input: {
        seatRef: string;
        reason: string;
        operator?: string | null;
    }): Promise<CleanSeatResult>;
    /** Finish context delivery to the same fresh occupant after its native gate.
     * This never launches a process or replays an uncertain/finished delivery.
     */
    continueFreshStartup(seatRef: string): Promise<{
        ok: false;
        code: string;
        message: string;
    } | {
        message: string;
        warnings?: string[];
        ok: true;
        startupStatus: "ready";
        continuityOutcome: "resumed" | "fresh" | "forked" | "rebuilt";
        submission?: {
            status: "unverified" | "staged";
            reasons: string[];
            warning?: string;
            diagnostics?: import("./startup-submission-evidence.js").StartupSubmissionDiagnostic[];
        };
        code?: undefined;
    } | {
        message: string;
        warnings?: string[];
        ok: false;
        startupStatus: "attention_required" | "failed";
        errors: string[];
        evidence?: string;
        recovery?: string;
        missingConversation?: true;
        code?: undefined;
    }>;
    private continueFreshStartupUnchecked;
    /**
     * Resolve a seat snapshot into current launch settings and persisted startup context.
     * Return a refusal for stale seats, unavailable services, or runtime/context mismatch.
     * Reads only: callers receive no reservation or launch guarantee. Execution repeats
     * this resolution under its lifecycle lock rather than trusting an earlier plan.
     */
    private resolveFreshLaunch;
    /**
     * Validate an observed canonical collision against current managed rows and binding.
     * `stop` authorizes only this matching occupant; it cannot authorize adopted or
     * mismatched sessions. Return its session row or a refusal, including unknown pane
     * observations, without stopping, repairing, or starting a tmux server.
     */
    private validateFreshCollision;
    /**
     * Check historical rows/bindings that clean would touch, excluding the canonical name.
     * Read-only tmux probes reject adopted, live, or unreadable historical occupants
     * before any stop. Null means no historical blocker was observed; the caller must
     * still validate the canonical occupant and recheck absence before launching.
     */
    private validateFreshHistory;
    /**
     * Snapshot one seat's proposed fresh launch; `fresh` is mandatory and `stop` is intent.
     * No lifecycle lock, repair, material projection, native launch or persistent write
     * is entered. Siblings are listed as unchanged; no seat is reserved by the result.
     * Known blockers set launchable=false; otherwise incomplete observations yield null.
     * Unreadable tmux remains incomplete, never readiness. No launch command is built.
     * Errors are reduced to safe codes;
     * startup text, credentials and process output are not included in the response.
     */
    planFresh(input: {
        seatRef: string;
        fresh: boolean;
        stop?: boolean;
    }): Promise<{
        planOnly: true;
        complete: boolean;
        launchable: false;
        message: string;
        ok: false;
        code: "seat_ref_required" | "seat_not_found" | "seat_ambiguous" | "missing_model" | "missing_reason" | "permission_selection_refused" | "no_session" | "claimed_session" | "session_not_live" | "session_live" | "tmux_probe_failed" | "nothing_to_clean" | "fresh_required" | "unmanaged_session_collision" | "startup_context_missing" | "startup_context_malformed" | "startup_context_runtime_mismatch" | "runtime_adapter_missing" | "launch_unavailable" | "launch_failed" | "startup_failed" | "attention_required" | "runtime_identity_unverified" | "not_codex" | "typing_guard_enabled" | "missing_effort" | "invalid_effort" | "effort_unsupported_runtime" | "effort_unavailable" | "invalid_policy";
        guidance?: string;
        matches?: Array<{
            rig_name: string;
            logical_id: string;
            current_occupant: string | null;
        }>;
    } | {
        ok: true;
        planOnly: true;
        complete: boolean;
        launchable: boolean | null;
        seat: SeatDescriptor;
        sessionName: string;
        currentOccupant: string;
        stopRequired: boolean | null;
        wouldStop: boolean | null;
        blockers: {
            code: string;
            message: string;
            guidance?: string;
        }[];
        warnings: string[];
        siblings: {
            logicalId: string;
            sessionName: string | null;
            effect: "unchanged";
        }[];
        startup: {
            projectionCount: number;
            fileCount: number;
            actionCount: number;
        };
    }>;
    /**
     * Execute a fresh replacement of exactly one seat, requiring fresh intent and reason.
     * Resolve configuration again under the lifecycle lock, reject unsafe historical or
     * canonical occupants, and require positive absence before creating a new occupant.
     * Unlike planFresh this mutates lifecycle/startup state; an earlier preview grants
     * no authority to skip validation. Sibling seats are never included in the operation.
     */
    launchFresh(input: {
        seatRef: string;
        fresh: boolean;
        reason: string;
        stop?: boolean;
        operator?: string | null;
    }): Promise<LaunchFreshResult>;
    /**
     * OPR.0.7.0.5 — restart one Codex seat in place so it reads its home's current account: same conversation,
     * same pane, the settings it is running with now. `plan` runs every gate read-only. Activity (mid-turn,
     * needs input) and child processes are reported for the operator to judge, not refused. Identity, typing
     * guard, adopted sessions, unreadable tmux and settings drift are named refusals before any signal.
     */
    restartInPlace(input: {
        seatRef: string;
        reason?: string;
        plan?: boolean;
        operator?: string | null;
    }): Promise<RestartInPlaceResult>;
    /** `--verify`: report `moved` only with a completed tool turn since the restart and account-specific evidence. */
    verifyRestartInPlace(input: {
        seatRef: string;
        expectAccount?: string | null;
    }): Promise<VerifyRestartInPlaceResult>;
    private inPlaceRestarter;
    /** The shared seat refusals, then the binding the relaunch is built from (the handover's posture rules). */
    private inPlaceTarget;
    private stopManagedTmuxSeat;
    private nonTerminalSessions;
    private sessionResumeToken;
    private readStartupContext;
    private malformedStartupContext;
    private compensateFailedFreshLaunch;
    /**
     * The ONE liveness read both mutating verbs share (fix r1, row 9baac99f):
     * the CLASSIFIED probeSession, never the collapsed hasSession view.
     *   present / absent        → returned for the verb to act on (absent is
     *                             POSITIVE tmux evidence, per OPR.0.5.4.2).
     *   transport_unavailable   → an INDETERMINATE refusal: session existence was
     *                             NOT determined, so neither verb may act — and the
     *                             refusal never routes the operator to a
     *                             destructive verb.
     *   unexpected probe throw  → the same indeterminate refusal (fail closed).
     */
    private probeLiveness;
    private requireReason;
    private describe;
    private latestSession;
    /** The ONE resolution path, mirroring SeatStatusService.findMatches semantics
     *  (seat-status-service.ts) so every seat verb resolves identically: a canonical
     *  `name@rig` ref scopes to that rig's inventory; a bare ref scans all rigs;
     *  matches are by canonicalSessionName or logicalId; >1 match is a listed
     *  ambiguity, never a pick. */
    private resolveSeat;
    private findMatches;
}
//# sourceMappingURL=seat-lifecycle-service.d.ts.map