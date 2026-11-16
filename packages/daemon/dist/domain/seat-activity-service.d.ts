import type Database from "better-sqlite3";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { EventBus } from "./event-bus.js";
import type { SeatActivity } from "./types.js";
import type { ActivityEvidence, AdapterRungInventory, ArbitratedSeatState, RungHealthEvent } from "./activity-taxonomy.js";
/** Default polling cadence: 1Hz. The default silence window is 3s, so
 *  1Hz polling gives at-most ~1s freshness lag on the cached observation. */
export declare const DEFAULT_POLL_INTERVAL_MS = 1000;
/** Allow automatic review to settle before checking the visible human prompt. */
export declare const PERMISSION_REQUEST_GRACE_MS = 3000;
/**
 * Slice 15 — daemon owner of the `terminal-active` primitive.
 *
 * Polls tmux's `#{window_activity}` last-activity timestamp per seat
 * (via TmuxAdapter.readPaneLastActivity) and keeps the latest
 * observation keyed by canonical session name. Active/idle is derived
 * by comparing the observed timestamp's age against the silence-window
 * threshold. Downstream consumers (ps-projection, node-inventory, UI
 * hooks) read via `getSeatActivity(canonicalSessionName)`.
 *
 * Non-inference contract (slice 15 IMPL-PRD §2.3, HG-4): this service
 * NEVER reads queue/assignment state. Its constructor surface
 * intentionally rejects any queue/assignment-shaped dependency so a
 * future contributor cannot wire one in without first amending the
 * design. The companion `hasAssignedWork` primitive lives in the
 * ps/queue projection and never imports this service either.
 */
export interface SeatActivityServiceDeps {
    tmux: Pick<TmuxAdapter, "readPaneLastActivity"> & Partial<Pick<TmuxAdapter, "readAllSessionWindowActivity">>;
    defaultWindowSeconds: number;
    eventBus?: EventBus;
    now?: () => Date;
    /** Visible prompt observation: null means capture could not establish a state. */
    permissionPromptReader?: (sessionName: string) => Promise<boolean | null>;
    permissionPromptChanged?: (sessionName: string, confirmed: boolean) => void;
    /** Claude pid.json, consulted for seats declaring self-report. */
    selfReportReader?: (sessionName: string, seatNodeId: string) => ActivityEvidence | null;
}
export interface PollSeatOptions {
    silenceWindowSeconds?: number;
}
export declare class SeatActivityService {
    private readonly tmux;
    private readonly defaultWindowSeconds;
    private readonly eventBus;
    private readonly now;
    private readonly latestByPaneId;
    private sweeping;
    private readonly permissionPromptReader?;
    private readonly permissionPromptChanged?;
    private readonly selfReportReader;
    constructor(deps: SeatActivityServiceDeps);
    /**
     * Read the window's last-activity timestamp for `paneId` once and
     * record an `isActiveWithinWindow` observation by comparing it to
     * the configured silence window.
     *
     * Returns the new SeatActivity record, or null when no signal is
     * available (transient tmux error, blank/unparseable timestamp).
     *
     * Slice 15 BLOCKING-fix: pivoted from reading the runtime's
     * `pane_silence_flag` (observed blank on tmux 3.6a, sticky-alert
     * behavior on others) to computing active/idle ourselves from
     * `window_activity` — the same timestamp tmux's own status-line
     * activity indicators consult.
     */
    pollSeat(paneId: string, opts?: PollSeatOptions): Promise<SeatActivity | null>;
    /** pollSeat with the sweep's batched read: the seat's timestamp comes from `batch` when it has one, and
     *  only a seat missing from it is read per target, so a sweep costs one tmux spawn instead of one per seat. */
    private observeSeat;
    private pollPermissionPrompt;
    /**
     * Return the latest stored observation for a seat, or null when no
     * observation has been recorded yet (e.g. service hasn't polled this
     * seat). Distinct from `isActiveWithinWindow: false`.
     */
    getSeatActivity(paneId: string): SeatActivity | null;
    /** Retire a session's observation and oracle evidence (used on seat teardown).
     *  Keep the durable seat's state/seq so readers and waiters see it become unknown. */
    forgetSeat(paneId: string): void;
    /**
     * Slice 15 — refresh observations for every running tmux-bound seat.
     * Drives the per-tick cadence from `start(intervalMs, db)`; callers
     * can also invoke directly for tests or one-shot refresh.
     */
    pollAllRunningTmuxSeats(db: Database.Database): Promise<void>;
    private timer;
    /**
     * Start the scheduler. Polls every running tmux-bound seat once per
     * `intervalMs`. Idempotent — calling twice is a no-op.
     */
    start(db: Database.Database, intervalMs?: number): void;
    /** Stop the scheduler. Safe to call before start or multiple times. */
    stop(): void;
    private readonly ladder;
    private readonly sessionToSeat;
    private readonly healthListeners;
    private readonly samplerSeqBySession;
    /** An adapter (or an occupant swap) declares which rungs this seat's sources staff.
     *  The binding ties the durable seat nodeId to its current pane/session name so the
     *  internal sampler can feed the window-sampling rung for this seat. */
    declareRungInventory(binding: {
        seatNodeId: string;
        sessionName: string;
    }, inventory: AdapterRungInventory): void;
    /** Adapters push rung evidence (hooks, self-report, chrome, sampling). Per-source
     *  monotonic seq: stale or reordered reports are dropped — a late lower-seq event
     *  never revives an idle seat (the SubagentStop class at the service layer). */
    reportEvidence(evidence: ActivityEvidence): void;
    /** A handover/generation swap: its OWN visible event, never an activity transition.
     *  Evidence, debounce, contradiction and promotion state are cleared; every known
     *  rung's trust drops to `absent` until the successor's adapter RE-DECLARES its
     *  inventory (AM-1 corollary: a successor never inherits rung authority). */
    declareOccupantSwap(seatNodeId: string, generation: string): void;
    /** Whether this seat currently has a DECLARED rung inventory (a swap clears it —
     *  the successor must re-declare before its rungs regain any trust). When supplied,
     *  sessionName also verifies the inventory belongs to that current session. */
    hasRungInventory(seatNodeId: string, sessionName?: string): boolean;
    /** Resolve by CURRENT session name (projection convenience) — state itself stays
     *  keyed by the durable seat nodeId. */
    getSeatStateBySession(sessionName: string): ArbitratedSeatState | null;
    /** The arbitrated, seat-keyed state every surface renders from. */
    getSeatState(seatNodeId: string): ArbitratedSeatState | null;
    /** Wait-after-seq read primitive (T1 seam, exposed not consumed here): resolves when
     *  the arbitrated seq passes `afterSeq` (a fast pass-through transition still
     *  satisfies the wait — the lost-wakeup guard). Timeout resolves null, never throws. */
    waitForSeatState(seatNodeId: string, opts: {
        afterSeq: number;
        timeoutMs: number;
    }): Promise<ArbitratedSeatState | null>;
    /** Rung-health transitions (AM-1): degradations and promotions are VISIBLE, never silent. */
    onRungHealth(listener: (event: RungHealthEvent) => void): void;
    private seatLadder;
    /** Trust for a rung: declared trust when an inventory exists; without a declaration
     *  the generic tmux floor (window-sampling) is authoritative and everything else is
     *  identity-only — partial-coverage honesty by default. */
    private rungTrust;
    /** Latest evidence for a rung. kind "activity" returns the newest ACTIVITY-BEARING
     *  evidence — a needs-input-only event from the same source (e.g. PermissionRequest
     *  mid-turn) must not erase what the source last said about working/idle. */
    private latestByRung;
    /** AM-2: a TRIAL rung's evidence is measured against the current authoritative
     *  CANDIDATE value (raw ladder decision, pre-debounce) — evidence against evidence,
     *  never against the debounced display. Enough agreements over at least the minimum
     *  window promote the rung to authoritative, visibly. */
    private measureTrialAgreement;
    /** The raw ladder decision for working/idle: highest authoritative rung with usable,
     *  in-window evidence. Hook evidence is TIME-BOUNDED (the one rung that does not
     *  self-date its lifecycle) — expired hook evidence falls through, never errors. */
    private rawCandidate;
    private emitRungHealth;
    /** AM-1: persistent cross-rung contradiction (hook claims working while a lower
     *  authoritative rung sees idle-at-prompt beyond the stated window) degrades the hook
     *  rung to identity-only, VISIBLY — arbitration can never make a silently-dead source
     *  authoritative. */
    private checkContradiction;
    private rungsView;
    /** Recompute the arbitrated state. Debounce: a sampling-decided working→idle
     *  transition holds until the stated consecutive idle observations or the hard cap;
     *  an authoritative turn boundary (hooks/self-report idle) or idle chrome publishes
     *  instantly. Chosen against our 1Hz/3s cadence: the 3s silence window already
     *  absorbs sub-3s lulls; the 2-tick arbitration debounce absorbs the
     *  window-boundary flap. */
    private arbitrate;
    /** AM-R18 push substrate: a change notification (identity + seq) onto the bus — the
     *  SSE stream relays it; consumers REHYDRATE from the projection, so the push itself
     *  never carries derived vocabulary (no second activity mechanism by construction). */
    private emitActivityChanged;
    private resolveWaiters;
}
/** Hook evidence older than this no longer decides working/idle (time-bounded authority). */
export declare const HOOK_AUTHORITY_WINDOW_MS = 15000;
/** Persistent hook-vs-sampler contradiction beyond this window degrades the hook rung. */
export declare const CROSS_RUNG_CONTRADICTION_WINDOW_MS = 10000;
/** Sampling-decided working→idle needs this many consecutive idle evaluations… */
export declare const SAMPLING_IDLE_DEBOUNCE_TICKS = 2;
/** …bounded by this hard cap; authoritative turn boundaries and idle chrome bypass instantly. */
export declare const SAMPLING_IDLE_DEBOUNCE_CAP_MS = 2500;
/** AM-2 promotion: a trial rung earns authority after this many agreeing observations… */
export declare const RUNG_PROMOTION_AGREEMENT_COUNT = 50;
/** …spread over at least this window of production time. */
export declare const RUNG_PROMOTION_MIN_WINDOW_MS: number;
//# sourceMappingURL=seat-activity-service.d.ts.map