import { type StartupSubmissionEvidence } from "./startup-submission-evidence.js";
export { inspectStartupStagedText } from "./startup-submission-evidence.js";
import type Database from "better-sqlite3";
import type { RigRepository } from "./rig-repository.js";
import { type SessionRegistry } from "./session-registry.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import { type AgentActivityStore } from "./agent-activity-store.js";
import type { EventBus } from "./event-bus.js";
import type { AgentActivity } from "./types.js";
import type { GuardTarget, SeatDeliveryGuard } from "./seat-delivery-guard.js";
import { type EnvelopeScope } from "../lib/pane-envelope.js";
import { type NativeProcessLister } from "./native-process-lineage.js";
import type { SlowOperationInstrumentation } from "./slow-op-recorder.js";
import { type CaptureObserverSink, type ObservedBinding } from "./capture-observer.js";
import { type NodeBinding, type ReadinessResult } from "./runtime-adapter.js";
export interface PaneActivityClassification {
    state: "agent_active" | "agent_idle" | "attention" | "unknown";
    reason: string;
    evidence: string | null;
}
export interface ClassifyPaneOptions {
    /** Treat a timer-less live status row above the composer as work in progress. */
    timerlessStatusIsLive?: boolean;
}
/** True only when the last prompt line has text and all of it is faint, as Claude renders its
 *  suggestion. An empty last prompt, or a capture without escape sequences, never proves faint. */
export declare function promptTextIsFaint(styledPane: string): boolean;
/** Classifies one Claude capture taken with escape sequences, as a single frame. `suggestion` is set
 *  only when that frame's own draft is its last prompt line and all of that text is faint: it's then
 *  the frame classified as an empty composer. */
export declare function classifyStyledFrame(styledPane: string, options?: ClassifyPaneOptions): {
    frame: string;
    asIs: PaneActivityClassification;
    composer: string | null;
    suggestion: PaneActivityClassification | null;
};
/** A community agent app's screen never proves it's idle: a quiet prompt can be an approval or a pause, so its idle
 *  reading becomes unknown. Positive work and attention are kept. `agentApp` is the seat's recorded selection
 *  (`agentAppOf`); without it the classification is returned as it is. */
export declare function agentAppPaneActivity(classification: PaneActivityClassification, agentApp: string | null | undefined): PaneActivityClassification;
export declare function classifyPaneActivity(paneContent: string, options?: ClassifyPaneOptions): PaneActivityClassification;
export declare function probeSessionActivity(input: {
    sessionName: string | null;
    runtime: string | null;
    attachmentType: "tmux" | "external_cli" | null | undefined;
    tmuxAdapter: TmuxAdapter;
    now?: Date;
    /** S01/S02 P2: optional read-only observer of the capture this probe already takes. */
    captureObserver?: CaptureObserverSink;
    binding?: Omit<ObservedBinding, "sessionName">;
    /** See ClassifyPaneOptions.timerlessStatusIsLive. */
    timerlessStatusIsLive?: boolean;
    /** The seat's community agent app (`agentAppOf`): its idle-looking screen reads unknown. */
    agentApp?: string | null;
}): Promise<AgentActivity>;
export declare function mapPaneState(state: PaneActivityClassification["state"]): AgentActivity["state"];
/** Map a resolved fan-out target + its recipient list → the EnvelopeScope (ruling 03c35295). The
 *  transport knows the target shape + resolved seats, so it builds the honest scale daemon-side:
 *  DM / multi (full list) / rig- or pod-scoped broadcast (with seat count) / topology. */
export declare function scopeForTarget(target: TargetSpec, recipients: string[]): EnvelopeScope;
export type TargetSpec = {
    session: string;
} | {
    sessions: string[];
} | {
    rig: string;
} | {
    pod: string;
    rig?: string;
} | {
    global: true;
};
export type ResolveResult = {
    ok: true;
    sessions: Array<{
        sessionName: string;
        rigName: string;
        nodeLogicalId: string;
    }>;
} | {
    ok: false;
    code: "not_found" | "ambiguous";
    error: string;
};
/** The existing submit-only identity check, also used to inspect startup's own paste.
 * A false result is no matching staged evidence, not proof of model consumption. */
export declare function hasExpectedStagedText(pane: string | null, expected: string, runtime?: string | null): boolean;
/** What the seat showed in the capture taken before the paste, with transport.verify_input_box on: `idle` only
 *  when the frame has one of the idle shapes below; `not-idle` when any row of it is a running, streaming,
 *  queued, pending-input or paste-hint row; `unknown` for anything else, including no capture and a frame that
 *  names another client version. Only `idle` lets a send read verified, so a seat whose running turn hides its
 *  signals reads unconfirmed. */
export type SeatReading = "idle" | "not-idle" | "unknown";
/** The seat before the paste (see SeatReading), read from the capture the transport already takes before it.
 *  `sessionName` is the seat's own session name, which a Claude Code seat launched by OpenRig draws on its box.
 *  A frame that names another client version is `unknown`. */
export declare function readSeatBeforePaste(pane: string | null, runtime: "claude-code" | "codex", sessionName?: string): SeatReading;
/** What a Claude Code or Codex input box shows, read from the input box only (never the transcript). Labels and
 *  placeholders (Claude's queued label and Try suggestion, collapsed pastes, Codex's empty-box placeholder) are
 *  checked before the sent text, so none of them can read as `exact`. The sent text is `exact` only with its word
 *  boundaries kept, and `ambiguous` where the box's row breaks leave them uncertain (boxHoldsText). A frame that
 *  names another client version reads `unrecognized` (RECORDED_CLIENT_VERSION).
 *
 *  An empty box also reads `queued` where the frames say the message may wait behind a turn: Codex's
 *  pending-input rows above the box, rows between Codex's running-turn status row and the box, or
 *  `beforeEnter` (the frame read just before Enter) showing a running turn (Codex's status row, or
 *  `claudeTurnRunning`). These readings decide the verdict: verified needs `empty` after Enter. For a seat that
 *  was not idle before the paste they only say why the send is unconfirmed (readSeatBeforePaste already rules it
 *  out), but for a seat that was idle they are the only check that rejects a message queued behind a turn that
 *  started after the pre-paste capture and shows in the frame read before Enter.
 *  Used only to report a send with transport.verify_input_box on. */
export declare function readInputBox(pane: string | null, runtime: "claude-code" | "codex", text: string, beforeEnter?: string | null): InputBoxReading;
export interface SendOpts {
    /** Internal managed lifecycle prerequisite; never accepted from HTTP send options. */
    beforeWrite?: () => void;
    /** Stable caller request ID, reused for readback after transport uncertainty. */
    deliveryId?: string;
    auditPointer?: string;
    /** Internal queue seam: already committed original members, never client-supplied. */
    committedOutboxIds?: string[];
    verify?: boolean;
    force?: boolean;
    waitForIdleMs?: number;
    /** Internal #1084 seam: a lease-free idle wait already completed in send()
     *  before the serial lease; sendUnguarded consumes this evidence instead of
     *  waiting again, then re-checks readiness just before typing. Never
     *  client-supplied. */
    preWaitedIdle?: {
        activity: AgentActivity;
        waitedMs: number;
        attempts: number;
        deadlineAt: number;
    };
    /** Internal #1084 seam: the delivery-guard target bound before the
     *  lease-free wait; the leased send refuses with guard_target_changed when
     *  the seat changed hands meanwhile. Never client-supplied. */
    preWaitBound?: GuardTarget;
    /** Internal, with `waitForIdleMs`: decide idle from a live pane read only. A runtime hook can't
     *  authorize the send (a hook saying the seat waits on a person still refuses). For a caller whose
     *  latest hook may predate the state that matters, such as a post-compact drain whose newest hook
     *  can be the Stop from before /compact. */
    readinessFromPaneOnly?: boolean;
    dangerouslyInteract?: boolean;
    reason?: string;
    actorSession?: string | null;
    stampISO?: string;
    submitOnly?: boolean;
    expectedStagedText?: string;
    /** Internal startup caller needs a bounded view of an expanded multiline composer. */
    submitOnlyCaptureLines?: 50 | 200;
    /** Internal startup only: require complete visible composer identity before Enter. */
    requireFullStagedText?: boolean;
    /** Internal, synchronous diagnostics sink. Exceptions never affect transport. */
    onStartupMismatch?: (evidence: StartupSubmissionEvidence) => void;
    /** Round-2 (r2 HIGH-1): the walked piece's own line count — placeholder identity. A large paste
     *  renders as "[Pasted text #N +X lines]"; X must match this count for the placeholder to count
     *  as evidence of THIS piece. */
    expectedStagedLineCount?: number;
}
export interface BroadcastOpts extends SendOpts {
    envelopeSender?: string;
}
export interface SendResult {
    ok: boolean;
    sessionName: string;
    verified?: boolean;
    /** Audited prompt answer: consumers must never automatically retry Enter.
     * Neither value establishes model consumption. Absent for ordinary sends. */
    promptInteraction?: "enter-sent" | "unverified";
    /**
     * OPR.99.0.6.3 — honest delivery-outcome vocabulary (additive; `verified`
     * keeps its exact semantics for existing parsers). Three distinguishable
     * states, mirroring the restore honest-outcome style:
     * - `delivered`: text + Enter landed AND the post-send capture re-confirmed
     *   the snippet (the strong positive; was `Verified: yes`).
     * - `rendered-unconfirmed`: text + Enter BOTH succeeded (the message landed)
     *   but the post-send capture raced a TUI redraw and could not re-confirm
     *   the snippet. Landed-but-unconfirmable, NOT a failure — confirm with
     *   `rig capture` if it matters. (Was collapsed into `Verified: no`.)
     *   For a prompt answer, `promptInteraction: "unverified"` means input was
     *   sent without added Enter; the prompt may already have consumed it.
     * - `failed`: the transport itself failed (paste or Enter did not land) —
     *   set on the send_failed / submit_failed returns for vocabulary symmetry;
     *   their `ok:false` + HTTP mapping is unchanged.
     */
    outcome?: "delivered" | "rendered-unconfirmed" | "failed" | "retained";
    outboxIds?: string[];
    warning?: string;
    error?: string;
    reason?: string;
    /** Set on the submit-only (bare Enter) mode's success — no text was typed. */
    submitOnly?: boolean;
    activity?: AgentActivity;
    waitedMs?: number;
    attempts?: number;
    sent?: boolean;
    /** Present only when transport.verify_input_box applied to this send. */
    inputBox?: InputBoxEvidence;
}
/** One reading of a Claude Code or Codex input box: `exact` (the sent text, word boundaries kept), `ambiguous`
 *  (the sent text, but a row break in the box may fall inside a word, so its word boundaries cannot be told),
 *  `empty`, `queued` (Claude's queued-messages label, or an empty box while a turn was running, so the message may
 *  wait behind it), `hidden` (a collapsed paste label), `other` (any other text), `unrecognized` (no recognized
 *  input box, or a frame that names another client version), `unavailable` (no capture, or none in time) or
 *  `unchecked` (this path does not read the box: an audited prompt answer). */
export type InputBoxReading = "exact" | "ambiguous" | "empty" | "queued" | "hidden" | "other" | "unrecognized" | "unavailable" | "unchecked";
/** With transport.verify_input_box on: what the seat showed before the paste, and what a Claude Code or Codex
 *  input box showed before and after Enter. Reporting only. `verified` is true only for a seat proven idle
 *  before the paste, then exact, then empty, on the same pane process (`#{pane_pid}`, the pane's root process);
 *  that means the box was cleared after holding the text, normally by our Enter, never that the model read it.
 *  `sameProcess` compares the pane's root process (usually a shell) and the seat's binding: an agent restarted
 *  under the same shell is not caught by it, and the same pane and binding are not proof of the same native
 *  conversation. An audited prompt answer is not checked: `seat`, `before` and `after` read `unchecked`,
 *  `sameProcess` is false (a boolean, as on every other path), and the send reads unconfirmed. */
export interface InputBoxEvidence {
    seat: SeatReading | "unchecked";
    before: InputBoxReading;
    after: InputBoxReading;
    sameProcess: boolean;
}
export interface CaptureResult {
    ok: boolean;
    sessionName: string;
    content?: string;
    lines?: number;
    error?: string;
    reason?: string;
}
export interface BroadcastResult {
    total: number;
    sent: number;
    retained?: number;
    failed: number;
    results: SendResult[];
}
export interface TransportReadinessChecker {
    checkReady?(binding: NodeBinding): Promise<ReadinessResult>;
}
interface SessionTransportDeps {
    db: Database.Database;
    rigRepo: RigRepository;
    sessionRegistry: SessionRegistry;
    tmuxAdapter: TmuxAdapter;
    agentActivityStore?: AgentActivityStore;
    eventBus?: EventBus;
    now?: () => Date;
    sleep?: (ms: number) => Promise<void>;
    waitForIdlePollMs?: number;
    sendReadinessFreshnessMs?: number;
    slowOpRecorder?: SlowOperationInstrumentation;
    activityEndpointFile?: () => {
        baseUrl: string;
        token: string;
    } | null;
    /** S01/S02 P2: optional read-only capture observer. Absent by default (no activation). */
    captureObserver?: CaptureObserverSink;
    listProcesses?: NativeProcessLister;
    runtimeAdapters?: Record<string, TransportReadinessChecker>;
    /** transport.verify_input_box, read per verified Claude Code or Codex send. Absent means off. */
    verifyInputBox?: () => boolean;
}
export declare class SessionTransport {
    readonly db: Database.Database;
    private rigRepo;
    private sessionRegistry;
    private tmuxAdapter;
    private agentActivityStore?;
    private eventBus?;
    private now;
    private sleep;
    private waitForIdlePollMs;
    private sendReadinessFreshnessMs;
    private slowOpRecorder?;
    private activityEndpointFile;
    private captureObserver?;
    private listProcesses?;
    private runtimeAdapters;
    private inFlightReconciliations;
    private verifyInputBox?;
    constructor(deps: SessionTransportDeps);
    attachRuntimeAdapters(adapters: Record<string, TransportReadinessChecker>): void;
    /** Freeze the registration and binding before asking tmux about this name. */
    private absenceProbeTarget;
    /** Positive tmux absence only; a delayed reply cannot describe a replacement. */
    private recordSessionMissingVerdict;
    private getSessionMeta;
    resolveSessions(target: TargetSpec): Promise<ResolveResult>;
    private resolveGlobal;
    private resolveBySessionName;
    private resolveByList;
    private resolveByRig;
    private resolveByPod;
    private collectTransportTargetsForRig;
    deliveryTarget(sessionName: string): GuardTarget | null;
    get deliveryGuard(): SeatDeliveryGuard | undefined;
    retentionTarget(sessionName: string): GuardTarget | null;
    /** Deliver text and Enter to the resolved recipient under the send guards.
     * With verification requested, compare rendered message counts, excluding
     * agent input; a confirmed render does not prove agent consumption. */
    send(sessionName: string, text: string, opts?: SendOpts): Promise<SendResult>;
    /**
     * #1084/#1103: lease-free idle wait before the serial lease, so a long
     * --wait-for-idle holds up no other send or queue create to this seat.
     * Returns the wait evidence plus the occupant bound before the wait (both
     * threaded into the leased send), a failure result using main's exact
     * reasons, or null when the send must go through guard.operation exactly
     * as on main. Order matters: typing-guard decision first, then main's
     * quick refusals (runtime identity, wait validations, session probe),
     * then the wait. Only the lookups sit inside try: a late throw surfaces
     * instead of silently running a second full wait inside the lease.
     */
    private preWaitForIdle;
    private sendUnguarded;
    private inputBoxSettingOn;
    /** One input-box read, timed by the slow-op recorder and raced against the deadline. Null on timeout or
     *  error; an abandoned read is ignored. A read never decides whether Enter is sent. */
    private readWithinDeadline;
    /** After the post-Enter capture: the same pane process (pid read before Enter and now) and the same binding. */
    private inputBoxEvidence;
    private runStage;
    /** Wait on the existing classifier without occupying the input/lifecycle lease. */
    waitUntilIdle(sessionName: string, timeoutMs: number, signal?: AbortSignal): Promise<{
        ok: true;
        activity: AgentActivity;
        waitedMs: number;
        attempts: number;
    } | {
        ok: false;
        reason: string;
        error: string;
        activity: AgentActivity;
        waitedMs: number;
        attempts: number;
    }>;
    private waitForIdle;
    /** One readiness observation, raced against the time left before the wait's deadline. Null
     *  when the deadline wins; the abandoned observation is ignored, never delivered on. */
    private observeReadinessWithin;
    private claudeDeliveryObservation;
    /** Shell label without positive native proof; not proof of an idle shell or stopped agent.
     * Null when no shell label is observed, or the expected native process is verified. */
    private unverifiedShellForeground;
    private classifySendReadiness;
    private hookFreshForSend;
    private diagnoseProducerLink;
    private recordPromptOverride;
    capture(sessionName: string, opts?: {
        lines?: number;
    }): Promise<CaptureResult>;
    broadcast(target: TargetSpec, text: string, opts?: BroadcastOpts): Promise<BroadcastResult>;
    private getReconciliationSnapshot;
    /**
     * Reconcile non-ready startup state after successful session interaction (Refs #7).
     *
     * If an active session is in a non-ready startup state (`failed` or `attention_required`),
     * re-check readiness via the runtime adapter with currentness verification and atomic commit.
     */
    reconcileStartupReadiness(sessionName: string): Promise<boolean>;
    private doReconcileStartupReadiness;
}
//# sourceMappingURL=session-transport.d.ts.map