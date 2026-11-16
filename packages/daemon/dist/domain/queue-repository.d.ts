import type Database from "better-sqlite3";
import type { EventBus } from "./event-bus.js";
import { type LoadResult } from "./gateway/human-registry.js";
import type { PersistedEvent } from "./types.js";
import { QueueTransitionLog, type QueueTransition, type RecentQueueTransitionScope } from "./queue-transition-log.js";
import { type OutboxHandler } from "./outbox-handler.js";
import { type PickupReceipt } from "./queue-pickup.js";
import { type WaitingView, type WaitingActivityReader } from "./queue-waiting.js";
import { type ReplyToChoice } from "./reply-to-choice.js";
import { type DestinationClass } from "./gateway/destination-resolver.js";
import { type ClosureReason } from "./hot-potato-enforcer.js";
import { QueueWakeRepository, type ParkWakeStatus } from "./queue-wake-repository.js";
import { WatchdogJobsRepository } from "./watchdog-jobs-repository.js";
import { type HumanQuestion, type HumanAnswers, type RecordHumanAnswerResult } from "./human-questions.js";
export declare const QUEUE_STATES: readonly ["pending", "in-progress", "done", "blocked", "failed", "denied", "canceled", "handed-off"];
export type QueueState = (typeof QUEUE_STATES)[number];
/** OPR.0.4.6.FS-1 (W2 P1): the queue's terminal state set, named ONCE. The
 *  archiver (queue-retention.ts) AND the inline closure guards below all consume
 *  THIS predicate, so a future terminal-state addition can never silently
 *  diverge the archiver from the queue (arch D3-REFINEMENT P1; widen-never-sibling).
 *  `['done','handed-off']` is the full terminal set — workflow step closures exit
 *  `handoff -> state=handed-off`, the highest-volume terminal class. The `satisfies`
 *  clause is the compile guard: removing a state from QUEUE_STATES fails here. */
export declare const TERMINAL_QUEUE_STATES: readonly ["done", "handed-off"];
export declare function isTerminalState(state: string): boolean;
/** 0.5.1-53 — the ACTIVE (still-progressing) states. A blocker is "live" iff active; any other
 *  state (done/handed-off/canceled/denied/failed) means the block will never lift. This is DISTINCT
 *  from the archiver's TERMINAL_QUEUE_STATES (done/handed-off) — a narrower concept — so it is named
 *  separately and derived from QUEUE_STATES (the `satisfies` guard fails if a state is removed). */
export declare const ACTIVE_QUEUE_STATES: readonly ["pending", "in-progress", "blocked"];
export declare function isBlockerLive(state: string): boolean;
/** #96 — a Slack reply routes to the item that owns the thread root, so a later update may
 *  share that thread only while no reply there could answer a human decision. Deliberately
 *  BROADER than what makeHumanReplyResolver resolves today (it errs toward posting top-level): any
 *  active human-destined decision, or a row blocked on any human-class seat right now. A
 *  resolved park returns to in-progress; blocked_on alone (which the resolve verb documents
 *  keeping as provenance) is never a live gate. */
export declare function hasLiveHumanGate(item: {
    humanIntent?: string | null;
    state: string;
    destinationSession: string;
    blockedOn: string | null;
}): boolean;
/** 0.5.1-53 Atom 1a — typed non-qitem gate blocker prefixes. A park may be gated on a fold / auth /
 *  external condition that is NOT a qitem and NOT a human seat; these prefixes make such a gate a
 *  first-class, compact-visible, downstream-classifiable blocker (the ruling detail rides a transition). */
export declare const TYPED_GATE_BLOCKER_PREFIXES: readonly ["fold:", "auth:", "external:"];
export declare function typedGateBlockerPrefix(value: string): string | null;
/** A well-formed typed gate blocker: a recognized prefix AND a non-empty gate body. */
export declare function isTypedGateBlocker(value: unknown): boolean;
/**
 * #165: a claim is the destination acting on the row, which is stronger evidence than
 * the wake send could get. While the row is claimed, an unconfirmed wire result
 * (`delivered-ack-pending` or `indeterminate:*`) is presented as `claimed`. The stored
 * result is never rewritten, so a re-wake or an unclaim reads the wire result again.
 */
export declare function presentedNudgeResult(wireResult: string | null, claimedAt: string | null): string | null;
/**
 * 0.5.1-54 DR-1 (classifier fold, PM ruling qitem-20260811163927-74493d76) — classify a create-path
 * nudge FAILURE so the surfaced count becomes ACTIONABLE (constraint iii). Two classes:
 *   - "permanent-topology": the destination is not resolvable on THIS daemon (the nudge can never
 *     succeed here — a local-registry lookup reporting "not found" for a seat that lives on another
 *     daemon). Retrying is a guaranteed-permanent failure repeated on a schedule → NOT retryable;
 *     these belong to the ADDRESSING family, not to retry machinery. (The live corpus: 9/10 strands.)
 *   - "transient": a live, resolvable seat that refused THIS attempt (busy at an interactive prompt) or
 *     the attempt timed out — the only class a future bounded re-attempt (DR-2, held n=1) would touch.
 *   - "unknown": a failure whose text matches NEITHER known pattern. NOT silently defaulted to transient
 *     (ship-block ruling qitem-20260811170941-5eadb968): defaulting would assert "a live seat refused
 *     this attempt" for a string that only means "did not match the permanent pattern" — two different
 *     claims. An unknown must read as unknown (the same rule the ACTIVITY hookless=unknown ruling names);
 *     a default that collapses unknown into a known class is the exact sin, mirrored.
 * Returns null when `lastNudgeResult` is not a recorded failure (`failed:%`).
 *
 * Each class is a POSITIVE match — there is no default class. DR-2 (retry) stays HELD at n=1; this is
 * READ-side labeling only, making the strand's nature legible (addressing-fix vs retry vs triage-the-unknown).
 */
export declare function classifyNudgeFailure(lastNudgeResult: string | null | undefined): "permanent-topology" | "transient" | "unknown" | null;
export declare const QUEUE_PRIORITIES: readonly ["routine", "urgent", "critical"];
export type QueuePriority = (typeof QUEUE_PRIORITIES)[number];
export interface QueueItem {
    qitemId: string;
    tsCreated: string;
    tsUpdated: string;
    sourceSession: string;
    destinationSession: string;
    state: QueueState;
    priority: QueuePriority;
    tier: string | null;
    /** OPR.0.5.6.14 — the delivery LEDGER verdict for gateway-routed rows
     *  (posted / transport-failed / never-posted), derived from the row's own
     *  transitions. Pane-bound rows carry null — the field never lies about a
     *  class it does not govern. Populated on getById and findUndelivered. */
    deliveryOutcome?: "posted" | "transport-failed" | "never-posted" | null;
    /** The undelivered surface's class for ledger-derived entries (the route
     *  prefers this over the nudge-literal regex when present). */
    deliveryFailureClass?: string;
    /** Exact gateway receipt/error evidence for an undelivered ledger verdict. */
    deliveryFailureDetail?: string;
    tags: string[] | null;
    blockedOn: string | null;
    /** S04 — the DERIVED pickup receipt (unclaimed/working/stalled-after-claim/parked/terminal).
     *  Never stored: computed at projection time from state + claimed_at + the transition log
     *  + heartbeat; a closed row is terminal, never stalled. */
    pickup?: PickupReceipt;
    waiting?: WaitingView;
    handedOffTo: string | null;
    handedOffFrom: string | null;
    expiresAt: string | null;
    chainOfRecord: string[] | null;
    body: string;
    /** Explicit human delivery intent; null/omitted preserves legacy decisions. */
    humanIntent?: "decision" | "update" | null;
    /** One authored supplemental thread reply; the body remains a complete brief. */
    humanDetail?: string | null;
    /** #96 — the earlier qitem whose Slack thread this update posts into; null = own root. */
    replyTo?: string | null;
    /** #96 — set on full reads of a replyTo row: why delivery posted top-level instead
     *  (e.g. `root-missing`), or null when it threaded / has not been delivered. */
    replyToFallback?: string | null;
    /** #193 — structured questions on a decision (clickable options in Slack). */
    humanQuestions?: HumanQuestion[] | null;
    /** #193 — answers recorded from clicks, questionId → optionId; null until the first click. */
    humanAnswers?: HumanAnswers | null;
    /** Short human-readable subject; null for callers that omit it. */
    summary: string | null;
    /** OPR.0.4.4.19 FR-5 — pointer to the durable artifact a human judges
     *  (convention C3). NULL for all non-human-routed items (BR-1); required
     *  at the domain write path only when the §5 predicate is true. */
    evidenceRef: string | null;
    /** Present only on compact list rows, which omit these fields entirely so omitted content
     *  can't be mistaken for an empty value. Full reads never carry this marker. */
    fieldsElided?: Array<(typeof COMPACT_ELIDED_FIELDS)[number]>;
    closureReason: ClosureReason | null;
    closureTarget: string | null;
    /** Reporting only: local absence never proves a foreign successor is missing.
     * A matching local row suppresses it; this is not a continuing-custody check. */
    handoffAdvisory?: {
        status: "unverified";
        target: string;
        reason: "no-live-local-successor";
        message: string;
    };
    closureRequiredAt: string | null;
    claimedAt: string | null;
    lastNudgeAttempt: string | null;
    /** #165: the wake result as presented. A claimed row whose wire result was never
     *  confirmed (`delivered-ack-pending`, `indeterminate:*`) reads `claimed`; see
     *  `lastNudgeWireResult` for the result as recorded. */
    lastNudgeResult: string | null;
    /** #165: the wake send's result exactly as recorded, never rewritten by a claim. */
    lastNudgeWireResult: string | null;
    lastHeartbeat: string | null;
    resolution: string | null;
    /** PL-007 Workspace Primitive — typed repo scope for the qitem. Validated
     *  by the route layer against the source rig's RigSpec.workspace.repos[].
     *  Null when the task is unambiguously the rig's default_repo or
     *  ambiguity is absent. Stored as a dedicated TEXT column (migration 038). */
    targetRepo: string | null;
}
/**
 * Async transport contract — exists in this domain module so QueueRepository
 * can do durable+waking handoffs (Phase A contract: queue create / handoff /
 * handoff-and-complete are nudging by default unless caller opts out).
 *
 * The wired-in implementation is `SessionTransport` (packages/daemon/src/
 * domain/session-transport.ts), but the repository depends only on this
 * minimal shape so test code can supply a stub.
 */
export interface QueueNudgeTransport {
    deliveryTarget?(session: string): import("./seat-delivery-guard.js").GuardTarget | null;
    retentionTarget?(session: string): import("./seat-delivery-guard.js").GuardTarget | null;
    send(sessionName: string, text: string, opts?: {
        verify?: boolean;
        stampISO?: string;
        actorSession?: string;
        committedOutboxIds?: string[];
        deliveryId?: string;
        auditPointer?: string;
    }): Promise<{
        ok: boolean;
        verified?: boolean;
        error?: string;
        reason?: string;
        outcome?: string;
    }>;
}
export interface QueueCreateInput {
    qitemId?: string;
    sourceSession: string;
    destinationSession: string;
    body: string;
    priority?: QueuePriority;
    tier?: string;
    tags?: string[];
    expiresAt?: string;
    chainOfRecord?: string[];
    /** 0.5.1-53 Atom 2b — supersession back-link. When this qitem is the SUCCESSOR of a
     *  cancel-and-replace (the original recorded state=canceled + closure_reason=superseded +
     *  closure_target=<this>), handedOffFrom records the original so the successor is traversable
     *  back to what it replaced — the same lineage primitive handoff-and-complete already sets,
     *  now reachable from the raw create path so a supersession is not an unlinked orphan pair. */
    handedOffFrom?: string | null;
    /** PL-007 — typed repo scope for this qitem. Route validates against
     *  source rig's workspace.repos[]; unknown names rejected upstream. */
    targetRepo?: string | null;
    /** Explicit human delivery intent; omission preserves legacy decisions. */
    humanIntent?: "decision" | "update" | null;
    /** Explicit supplemental thread content, never an automatic split of the primary body. */
    humanDetail?: string | null;
    /** #96 — post this update into the named earlier qitem's Slack thread. Updates only; if
     *  that thread can't be used (e.g. a live human gate, see hasLiveHumanGate), it posts
     *  top-level and the row records why. */
    replyTo?: string | null;
    /** #822 — Slack inbound only: the item whose OpenRig thread a person's reply was typed in.
     *  Stored as this row's replyTo, so an update that answers this row (--reply-to it) walks on
     *  to that thread. It never steers this row's own posts: delivery reads replyTo on updates
     *  only. An item that does not exist is dropped, never a reason to lose the message. */
    inboundReplyTo?: string | null;
    /** #193 — 1–4 structured questions; accepted only with humanIntent "decision". */
    humanQuestions?: HumanQuestion[] | null;
    summary?: string | null;
    /** OPR.0.4.4.19 FR-5 — optional durable-artifact pointer. Persisted when
     *  present; required at the domain layer only for human-routed items. */
    evidenceRef?: string | null;
    /**
     * R1 fix (PL-004 Phase A revision): Phase A is durable + waking by default.
     * When true (or omitted), the repository nudges the destination after the
     * create transaction commits and persists last_nudge_attempt + last_nudge_result.
     * Operators opt out with `nudge: false` for cold-queue cases.
     */
    nudge?: boolean;
    /** P21 §4 era-stamp: the route passes `transport:v1` (sourceSession derived from the transport
     *  header chokepoint). Threaded onto the 'created' transition; absence = claimed-era. */
    identityProvenance?: string | null;
}
export interface QueueUpdateInput {
    qitemId: string;
    actorSession: string;
    state?: QueueState;
    /** Explicit acknowledgment for a deliberate terminal → active repair. */
    reopen?: boolean;
    /**
     * OPR.0.4.6.WF3 FR-6 — set ONLY by the workflow domain's own write
     * paths (projector close, route close): they hold the frontier
     * invariant, so the close-path guard exempts them. Not a security
     * boundary — a correctness foot-gun guard (pm ruling: prevention).
     */
    viaWorkflowVerb?: boolean;
    transitionNote?: string;
    closureReason?: string;
    closureTarget?: string;
    /** The outcome stored in queue_items.resolution when this update closes a row that is still open;
     *  appended after anything the row already carries. Ignored on every other update. */
    resolution?: string;
    /**
     * PL-004 Phase D extension: when set, persists the queue_items.handed_off_to
     * column. Used by workflow-projector for state=handed-off transitions so
     * the canonical "next owner" pointer is recoverable from queue state alone.
     * Optional to preserve backward compatibility with existing update() callers.
     */
    handedOffTo?: string;
    /**
     * PL-004 Phase D extension: when set, persists the queue_items.blocked_on
     * column. Used by workflow-projector for state=blocked transitions so the
     * blocker reference (qitem id, gate name) is recoverable from queue state.
     */
    blockedOn?: string;
    /** OPR.0.5.5.03 — park continuation. Exactly one explicit wake form may
     *  accompany a blocked transition; a live qitem blocker is inferred. */
    wakeWatchdogId?: string;
    wakeAfterSeconds?: number;
    /** Internal opt-in to repeating, event-first park reminders. Evidence is
     * compared structurally; an acknowledgment note is never progress. */
    wakeMaxSeconds?: number;
    wakeProgressEvidence?: Record<string, unknown>;
    /** Internal caller-supplied text for an atomic timer. Public queue routes do
     *  not expose this; workflow projection uses it to re-present the exact
     *  occurrence-bound continuation action instead of a generic reminder. */
    wakeMessage?: string;
    /**
     * OPR.0.4.4.19 FR-6 — park-time inputs. summary + evidence_ref are
     * updatable AT THE PARK MOMENT (state=blocked with a human-seat blocker),
     * not create-only: `rig queue block --summary --evidence-ref` persists
     * them onto the EXISTING item so the attention query + Packet 2 read
     * them. OPR.0.5.1 slice-51-06 D2: supplying them on a NON-park transition
     * is REJECTED (QueueRepositoryError "summary_evidence_not_persistable")
     * before any mutation — not silently ignored — so a caller never believes
     * unpersistable metadata was saved.
     */
    summary?: string | null;
    evidenceRef?: string | null;
    /** P21 §4 era-stamp: the route passes `transport:v1` (actorSession derived from the transport
     *  header chokepoint). Threaded onto the transition; absence = claimed-era. */
    identityProvenance?: string | null;
    /** System-owned ceremony kind. Never exposed as a free-form route field. */
    ownerNotificationKind?: "human-decision-resolved";
}
export interface QueueHandoffInput {
    qitemId: string;
    fromSession: string;
    toSession: string;
    body?: string;
    transitionNote?: string;
    priority?: QueuePriority;
    tier?: string;
    tags?: string[];
    /** Default true; nudge the destination after the close+create transaction. */
    nudge?: boolean;
    /** PL-007 — typed repo scope for the new qitem. When omitted, the new
     *  qitem inherits the source's targetRepo. */
    targetRepo?: string | null;
    /** OPR.0.4.1.18 — optional ~1–2 sentence summary for the NEW qitem. NOT
     *  inherited from the source (a handoff authors its own summary); omitted
     *  → NULL → Story degrade. */
    summary?: string | null;
    /** OPR.0.4.4.19 FR-5 — optional durable-artifact pointer for the NEW qitem.
     *  NOT inherited from the source (same authorship semantics as summary). */
    evidenceRef?: string | null;
    /** P21 §4 era-stamp: the route passes `transport:v1` (fromSession derived from the transport
     *  header chokepoint). Threaded onto both the source-close and new-item transitions. */
    identityProvenance?: string | null;
}
/**
 * Like {@link QueueHandoffInput} but the source qitem is closed as `done`
 * (terminal) instead of `handed-off` (intermediate). Use when the source seat
 * is fully complete with the work and the new qitem is the canonical
 * follow-on. Closure_reason is recorded as `handed_off_to` and the new qitem
 * is created in the same atomic transaction.
 */
export interface QueueHandoffAndCompleteInput extends QueueHandoffInput {
}
export interface QueueClaimInput {
    qitemId: string;
    destinationSession: string;
    /** P21 §4 era-stamp: the route passes `transport:v1` (destinationSession derived from the
     *  transport header chokepoint). Threaded onto the claim transition; absence = claimed-era. */
    identityProvenance?: string | null;
}
export interface QueueListOptions {
    /** Exact tag selection before the result bound (used by diagnostic occurrences). */
    tag?: string;
    destinationSession?: string;
    sourceSession?: string;
    state?: QueueState | QueueState[];
    /** PL-007 — filter qitems by target_repo. Exact match. */
    targetRepo?: string;
    limit?: number;
    asSession?: string;
    compact?: boolean;
    rig?: string;
    activeOnly?: boolean;
}
export declare class QueueRepositoryError extends Error {
    readonly code: string;
    readonly meta: Record<string, unknown> | undefined;
    constructor(code: string, message: string, meta?: Record<string, unknown>);
}
/** OPR.0.4.6.WF5 (guard-named fix shape): exported so the workflow
 *  domain can PREALLOCATE a gate packet's id — the class-(c) exception
 *  identity tags need occurrence:<gatePacketId> ON the packet at create
 *  (one item, tagged in its own create — never a second item, never a
 *  post-create tag rewrite). The queue still mints ids for every caller
 *  that does not preallocate. */
export declare function newQitemId(): string;
/**
 * OPR.0.4.6.MH3 Q-a: is this the SQLite PRIMARY KEY conflict on
 * queue_items.qitem_id? better-sqlite3 sets `.code` on its SqliteError; the
 * message check is a defensive twin so a driver-name change never silently
 * turns an idempotent absorb into a 500.
 */
export declare function isQitemPrimaryKeyConflict(err: unknown): boolean;
/**
 * OPR.0.4.6.MH3 D-1 (FR-4/FR-5): the deterministic cross-host SUCCESSOR id.
 *
 * A cross-host handoff exposes no caller `--id`, so the successor's dedup
 * identity must come from the operation itself: the id is a PURE, STATELESS
 * function of (source qitemId, destination session, destination host). Same
 * arguments → same id on every re-drive, across daemon restarts, with zero
 * local state — so the origin-side PRIMARY KEY absorb (Q-a) converges every
 * interrupted-close re-drive. Source→successor is 1:1 by construction (a
 * closed source is terminal; nothing re-opens it). The `qitem-xh-` namespace
 * makes collision with organic `qitem-<ts>-<hex>` ids structurally impossible
 * (plan R-2). The compound key is JSON-encoded — no hand-rolled separators.
 *
 * n1 residual (arch-named, inherent to the ratified at-least-once/no-2PC
 * fence — NOT a dedup bug): a re-drive naming a DIFFERENT destination before
 * the source close lands is a NEW handoff decision and derives a DIFFERENT
 * id, so it cannot absorb the earlier successor — that earlier successor can
 * remain live on the target host. The chain_of_record + cross-host provenance
 * tags keep such an orphan visible/traceable; the source-close conflict check
 * surfaces the disagreement rather than overwriting it.
 */
export declare function deriveCrossHostSuccessorId(sourceQitemId: string, destinationSession: string, hostId: string): string;
/** The retained next owner must describe this closure, not a handoff before a reopen. */
export declare function matchesRecordedHandoffTarget(qitemId: string, handedOffTo: string | null, closureTarget: string | null): boolean;
/**
 * Shared read-only lineage helper for handoff advisory and stuck sweep.
 * Checks whether a local successor item exists matching target (by qitem_id or destination_session)
 * linked to sourceQitemId (via handed_off_from or chain_of_record membership).
 *
 * Excludes source row itself (s.qitem_id != sourceQitemId). Guards chain_of_record with json_valid.
 * Throws on database/query errors so callers can handle lookup failures with their own policies.
 */
export declare function hasLinkedSuccessor(db: Database.Database, sourceQitemId: string, target: string): boolean;
/**
 * L3 — Queue repository. Owns CRUD over `queue_items` plus the wired-in
 * append-only transition log and hot-potato strict-rejection contract.
 *
 * Pattern mirrors `chat-repository.ts` (single class, atomic transactions,
 * persist-event-then-notify). Cross-rig validation hook is `validateRig` —
 * Phase A wires no-op; Phase B can plug in the rig registry to reject
 * phantom-rig destinations. POC compatibility: `qitem_id` shape preserved.
 */
declare const COMPACT_ELIDED_FIELDS: readonly ["body", "evidenceRef", "humanDetail", "waiting", "chainOfRecord", "replyTo", "humanQuestions", "humanAnswers"];
/** A compact listing row: the elided fields are absent, not empty, and `fieldsElided` names them. */
export type CompactQueueItem = Omit<QueueItem, (typeof COMPACT_ELIDED_FIELDS)[number] | "fieldsElided"> & {
    fieldsElided: Array<(typeof COMPACT_ELIDED_FIELDS)[number]>;
};
type FindOverdueOptions = {
    now?: string;
    rig?: string;
    limit?: number;
    compact?: boolean;
};
type FindUndeliveredOptions = {
    rig?: string;
    limit?: number;
    compact?: boolean;
};
/**
 * Stamp-at-FORWARD only (founder root invariant 2026-08-27, superseding 51-09 incr 4
 * stamp-at-write): a LOCAL write never calls this — local rows store the bare
 * member@rig. The cross-host forwarding routes (routes/queue.ts) call it so the
 * forwarding daemon stamps ITS OWN id as the origin before the remote create; the
 * remote's not-bare guard then stores the received triple verbatim (origin never
 * forged). FAIL-OPEN: no reconciled self-id, or a value that is not a bare
 * member@rig (already a triple / malformed), passes through unchanged.
 */
export declare function stampSelfHostSuffix(session: string): string;
export declare function stampSelfHostSuffix(session: undefined): undefined;
export declare function stampSelfHostSuffix(session: string | undefined): string | undefined;
/**
 * 51-09 increment 4b — additive TEACHING for the unknown_destination_rig refusal
 * (arch ruling c9964404, mechanism ii). 3-part destinations ALREADY refuse (BR-1:
 * member@rig@host greedy-folds to rig "rig@host", misses, rejects) — the code is
 * UNCHANGED (C1). When the rejected destination's greedy-parsed rig token CONTAINS
 * '@', return ADDITIVE structured fields (FR-7 precedent) teaching the out-of-band
 * path: the split echo + a hint naming `--host`. C4: a SELF-suffixed destination
 * names the self case and is NEVER auto-stripped/routed home (self-strip is option
 * (i), routed to arch). Returns undefined for 2-part / non-canonical tokens (the
 * refusal is byte-unchanged there). One helper, all four refusal sites (C2). Reads
 * the FR-8 parse contract; the parse family stays byte-identical (C3).
 */
export declare function destinationRigTeaching(session: string): Record<string, unknown> | undefined;
export declare function externalAdmissionTeaching(session: string, loadRegistry?: () => LoadResult): Record<string, unknown> | undefined;
/** The refusal teaching for ANY rejected destination: the @external entity teaching
 *  (A4b) OR the host-suffix teaching (4b). One helper, all four refusal sites. */
export declare function destinationRefusalTeaching(session: string, loadRegistry?: () => LoadResult): Record<string, unknown> | undefined;
export interface QueueDestinationAdvisory {
    code: "unmatched_destination_seat";
    destinationSession: string;
    availableDestinations: string[];
    message: string;
}
export declare class QueueRepository {
    readonly db: Database.Database;
    readonly transitionLog: QueueTransitionLog;
    private readonly eventBus;
    readonly destinationAdvisory: (sessionRef: string) => QueueDestinationAdvisory | null;
    private readonly validateRig;
    private transport;
    /** W1 (transactional closure): the durable wake-intent store. A terminal act
     *  (handoff / handoff-and-complete) stages an outbox intent row INSIDE its
     *  db.transaction so close + transition + intent commit as one act or none;
     *  the delivery drains from that committed intent afterward. Wired post-
     *  construction by startup (dep-graph ordering, like transport).
     *
     *  ABSENT = the test/bootstrap path, and what that means differs by caller —
     *  it is NOT a blanket best-effort fallback:
     *   • a nudge-intended TERMINAL close+successor act FAILS CLOSED (MF2):
     *     {@link assertTerminalClosureHasIntent} throws `wake_intent_store_unavailable`
     *     rather than produce an executed-but-unwoken item (pass `nudge:false` for a
     *     wake-less close);
     *   • {@link deliverWakeForSuccessor} — and only it — falls back to the pre-W1
     *     best-effort {@link maybeNudge} when no store is attached (P34 made that
     *     fallback real code rather than a promise in a comment). */
    private outbox;
    private resolveOccupantGeneration?;
    private readonly wakeRepo;
    private watchdogJobsRepo;
    /** PL-007 Workspace Primitive — true when migration 038 has applied the
     *  queue_items.target_repo column. Older test fixtures that bypass the
     *  canonical migration list don't have the column; INSERTs degrade to
     *  the pre-PL-007 statement and target_repo input is silently dropped.
     *  Production daemons always have the column (migration is in startup.ts). */
    private readonly hasTargetRepoColumn;
    private readonly hasSummaryColumn;
    private readonly hasHumanIntentColumn;
    private readonly hasReplyToColumn;
    private readonly hasHumanQuestionsColumn;
    private readonly hasEvidenceRefColumn;
    private readonly hasMintingGenColumn;
    private readonly hasClaimedGenColumn;
    private readonly hasQueueTransitionsTable;
    private readonly hasTransitionProvenanceColumn;
    private readonly hasOwnerNotificationColumns;
    private readonly loadHumanRegistryFn;
    /** OPR.0.4.6.WF3 FR-6 — injected by startup (never imported): the
     *  workflow domain's is-live-frontier-packet predicate. */
    private readonly workflowFrontierPredicate;
    constructor(db: Database.Database, eventBus: EventBus, opts?: {
        validateRig?: (sessionRef: string) => boolean;
        destinationAdvisory?: (sessionRef: string) => QueueDestinationAdvisory | null;
        /**
         * R1 fix (PL-004 Phase A revision): durable+waking-by-default transport
         * for create / handoff / handoff-and-complete. When provided, the
         * repository nudges the destination after the corresponding transaction
         * commits and records last_nudge_attempt + last_nudge_result via
         * recordNudgeAttempt(). When absent, no nudge is issued (caller is in
         * a test or daemon-bootstrap path where transport is not yet wired).
         */
        transport?: QueueNudgeTransport;
        /**
         * OPR.0.4.6.WF3 FR-6 — the frontier close-path guard's INJECTED
         * predicate (the validateRig injection precedent: the queue is
         * the lower primitive and NEVER imports the workflow domain;
         * startup wires the workflow domain's exported predicate in).
         * Absent (tests, bootstrap, pre-workflow schemas) = zero new
         * behavior.
         */
        workflowFrontierPredicate?: (qitemId: string) => {
            instanceId: string;
            workflowName: string;
        } | null;
        /**
         * GHOST-STAGE (h): resolve the SOURCE seat's atom-B occupant generation-uuid so a handoff
         * nudge carries the composing generation on its Sent: line (the injected-predicate precedent —
         * the queue is the lower primitive and never imports the session domain; startup wires
         * SessionRegistry.currentOccupantGenerationForSession in). Absent ⇒ UNKNOWN ⇒ the gen suffix
         * is omitted (never forged).
         */
        resolveOccupantGeneration?: (sessionName: string) => string | null;
        loadHumanRegistry?: () => LoadResult;
    });
    /** Startup attaches the generation-aware shared repository. Isolated domain
     *  fixtures fall back to a repository on this same SQLite connection. */
    attachWatchdogJobsRepository(repo: WatchdogJobsRepository): void;
    /** Startup wires this after queue/watchdog composition. Tests may also call
     * it after reconstruction; it only reconciles queue-owned repeating timers. */
    reconcileWaitReminders(changedQitem?: string, proofChanged?: boolean): void;
    startWaitReminders(): () => void;
    /**
     * Attach the wake-path transport AFTER construction. Used by daemon
     * startup, where SessionTransport is constructed later in the dep graph
     * than QueueRepository (because SessionTransport needs agentActivityStore
     * which itself needs eventBus). Calling this is safe at any time; create /
     * handoff / handoff-and-complete will start nudging on the next call.
     */
    attachTransport(transport: QueueNudgeTransport): void;
    /**
     * W1 (transactional closure): attach the durable wake-intent store AFTER
     * construction (same dep-graph reason as {@link attachTransport}). Once
     * attached, handoff / handoff-and-complete stage an outbox intent row inside
     * their terminal transaction, so the close and its wake intent are one commit.
     */
    attachOutbox(outbox: OutboxHandler): void;
    /** The one transition-write classifier. It consumes structured state/action facts only. */
    private classifyOwnerNotification;
    /**
     * W1 (transactional closure) — the PUBLIC composable primitive (stage half).
     * Stage the durable WAKE INTENT for a successor qitem from INSIDE a terminal
     * act's `db.transaction` (the queue's own connection), so the intent commits
     * atomically with the close + transition. Public + composable so any
     * close+successor writer — handoff / handoff-and-complete today, Mission Control
     * / Workflow via the P34 follow-on — can call it within its own transaction (the
     * `createWithinTransaction` precedent), making that wiring pure EXTENSION, not
     * rework. Pair with {@link assertTerminalClosureHasIntent}, run as the LAST
     * statement of the same transaction.
     *
     * The pane nudge itself is a post-commit side effect (reversed-never — a pane
     * write inside the txn would make the transaction lie); what is durable is this
     * intent row, which the delivery drains afterward. Freezes the emitting envelope
     * (MF4); idempotent by a deterministic outbox id keyed on the successor.
     * `nudge:false` intends no wake ⇒ no intent. A missing outbox is enforced by the
     * guard (fail-closed, MF2), not silently skipped here.
     */
    stageWakeIntent(successorQitemId: string, fromSession: string, toSession: string, identityProvenance: string | null, nudge: boolean | undefined): void;
    private recordWakeIntent;
    private stageAutoUnparkWakeIntent;
    private deliverWakeIntentAfterCommit;
    /**
     * W1-c (transactional closure): the runtime SEAM GUARD. Called as the LAST
     * statement inside a terminal act's db.transaction, it makes an
     * executed-but-unwoken close UNWRITABLE: if this transaction wrote a terminal
     * close AND a wake was intended, a durable wake intent for the successor MUST
     * exist in the same transaction. If it does not, throw — the whole act rolls
     * back at the seam, not at review.
     *
     * Nudge-aware: nudge:false intends no wake, so no intent is required. MF2:
     * fail-closed when a wake IS intended but no intent store is attached (the
     * guarantee is then impossible). PUBLIC composable primitive (guard half): any
     * close+successor writer runs this as the LAST statement of its own transaction
     * — handoff / handoff-and-complete today, Mission Control / Workflow via P34.
     */
    assertTerminalClosureHasIntent(sourceQitemId: string, successorQitemId: string, nudge: boolean | undefined): void;
    /**
     * W1-b: deliver ONE committed wake intent. MF3: CLAIM (pending→sending) before
     * the external send, then finalize (sending→outcome) after — so overlapping
     * drains send the wake exactly ONCE (the effect, not just the state), and a
     * second drain of an already-claimed/resolved intent skips. Returns what
     * happened for the drain's tally.
     *
     *   verified          → delivered
     *   ok, unverified    → indeterminate   (ambiguous; never silently delivered/failed)
     *   timeout (MF6)     → indeterminate   (may have landed — not a hard failure)
     *   other not-ok/throw→ failed          (visible terminal state)
     */
    private deliverWakeIntent;
    /**
     * W1-b: the post-commit delivery for a successor's wake, and the ONE shared
     * staged-intent delivery path. When the durable intent store is present
     * (production), deliver the just-committed intent — which CLAIMS and FINALIZES
     * the row, so a later recovery sweep cannot send it a second time. When it is
     * absent (test/bootstrap), fall back to the pre-W1 best-effort nudge so behavior
     * is unchanged where there is no intent to make durable. Called AFTER the
     * terminal transaction commits (reversed-never: a pane write must not join the
     * db transaction).
     *
     * PUBLIC as of P34: every terminal-closing writer that stages an intent must
     * deliver through THIS path rather than {@link maybeNudge}. `maybeNudge` sends
     * WITHOUT claiming or finalizing, so a staged intent would remain `pending` and
     * the startup recovery sweep would deliver the same wake AGAIN. One staged
     * intent, one delivery, one finalized row.
     *
     * P34 correction: the no-outbox fallback above was documented here but never
     * implemented — `deliverWakeIntent` simply returns "skipped" with no outbox
     * attached, so the nudge vanished SILENTLY (a skip is not an error, so nothing
     * surfaced it). The pre-W1 callers reached this path only after the MF2 guard
     * had already proven an outbox was attached, which is why it never showed. P34
     * routes writers here whose harnesses attach no outbox, so the fallback is now
     * real code rather than a promise in a comment.
     */
    deliverWakeForSuccessor(successorQitemId: string, destinationSession: string, nudge: boolean | undefined, sourceSession?: string): Promise<void>;
    /**
     * W1-b: the startup-recovery sweep. Delivers wake intents a crash left
     * committed-but-undelivered (the terminal txn committed, the process died
     * before the post-commit deliver). Pages in bounded batches and TERMINATES on
     * a served short batch or on a no-progress round (a flapping transport marks
     * rows failed = visible, so it still progresses) — never a silent cap, never a
     * spin.
     *
     * MF6 (honest retry policy): the sweep retries ONLY `pending` rows — i.e. wake
     * intents a crash left committed-but-undelivered. Terminal `failed` and
     * `indeterminate` rows are NOT re-driven: a failed row would risk resurrecting
     * a dead wake and an indeterminate one may already have landed (double-send).
     * Both are left in a VISIBLE terminal state for out-of-band reconciliation. No
     * periodic timer (out of scope, ruled); a bounded retry of failed rows is the
     * NAMED residue, not a silent guarantee.
     */
    /**
     * BLOCKING 1 (guard re-seal): the recovery-boundary reconciliation, called ONCE
     * at startup (NOT inside the drain, which can be invoked concurrently). Moves any
     * abandoned `sending` wake intents — a prior crashed process's claims — to
     * `indeterminate`, WITHOUT re-sending: a claim left `sending` is ambiguous (the
     * send may or may not have landed). Kept SEPARATE from drainPendingWakeIntents so
     * an overlapping drain can never reconcile another drain's in-flight claim.
     * Returns the count reconciled.
     */
    reconcileAbandonedWakeIntents(): number;
    drainPendingWakeIntents(): Promise<{
        delivered: number;
        indeterminate: number;
        failed: number;
        retained: number;
    }>;
    /**
     * Issue a default nudge to the destination after a create / handoff /
     * handoff-and-complete commit. Records the result via recordNudgeAttempt.
     * Errors are caught and surfaced as nudge_result strings — they do not
     * unwind the underlying queue mutation.
     *
     * Phase D extension point (orch-ratified): public so workflow-projector
     * can invoke after its outer transaction commits, completing the
     * createWithinTransaction()'s deferred post-commit side effects.
     *
     * V0.3.1 slice 23 queue-handoff-envelope: the nudge body
     * is now wrapped with the same From/To/---/body/---/↩ Reply envelope
     * that `rig send` uses. `sourceSession` is the seat that triggered
     * the create/handoff so the recipient pane shows where the nudge
     * came from + a reply hint. A queue nudge is the ONE non-refusable
     * sender — it has no seat to send an error back to — so when
     * `sourceSession` is undefined `wrapPaneEnvelope` applies its own
     * `<unknown sender>` fallback internally (`pane-envelope.ts`). After
     * A1 that is the SOLE definition of the marker in the tree (the CLI
     * copies were deleted, refused at the seat boundary instead); this
     * site holds no copy of its own.
     */
    maybeNudge(qitemId: string, destinationSession: string, nudgeOpt: boolean | undefined, sourceSession?: string, bodyOverride?: string): Promise<void>;
    /**
     * W1 (transactional closure): the shared wake-send CORE. Builds the pane
     * envelope, sends with verify, and CLASSIFIES the transport result into the W1
     * delivery vocabulary (verified | indeterminate | failed). It touches NO
     * persistence — callers decide what to record: {@link maybeNudge} records the
     * nudge attempt; {@link deliverWakeIntent} additionally CAS-marks the durable
     * intent row. Only ever called when `this.transport` is set (callers guard).
     *
     * The `indeterminate` classification is the ambiguous face: `res.ok && !res.verified`
     * — the delivery LANDED on the wire but its render could not be confirmed
     * (the "delivered-ack-pending" nudge literal). It is never promoted to
     * delivered nor demoted to failed.
     */
    private performWakeSend;
    create(input: QueueCreateInput): Promise<QueueItem & {
        /** Response-only: the retry's changed body was not written. Never stored on the row. */
        createWarning?: {
            code: "qitem_body_not_saved";
            message: string;
        };
    }>;
    /**
     * PL-004 Phase D extension point (orch-ratified per slice IMPL §
     * Driver Handoff Contract). Creates a queue item using the SAME
     * caller-managed db.transaction for transactional-scribe semantics
     * (workflow-projector folds step closure + next-qitem creation into
     * one atomic unit). Returns the persisted event AND qitem id so the
     * caller can defer notifySubscribers/maybeNudge until AFTER its
     * outer transaction commits.
     *
     * Caller MUST:
     *   1. Invoke this from inside a `db.transaction(() => {...})` block.
     *   2. After the outer txn commits, call:
     *        - eventBus.notifySubscribers(persistedEvent)
     *        - this.maybeNudge(qitemId, destinationSession, input.nudge)
     *   3. NOT call this from outside a transaction (will produce a
     *      half-state if the caller errors before committing).
     *
     * The split exists ONLY because notifySubscribers + maybeNudge are
     * post-commit side effects (subscribers should not see events for
     * data that may roll back; nudges should not fire for handoffs that
     * may roll back). For independent create()s that don't need to
     * compose with an outer transaction, use create() instead.
     */
    createWithinTransaction(input: QueueCreateInput): {
        qitemId: string;
        persistedEvent: PersistedEvent;
        destinationSession: string;
        nudge: boolean | undefined;
    };
    /**
     * Internal: insert + transition + emit event. Caller is responsible
     * for transaction wrapping (the public create() wraps; the public
     * createWithinTransaction() does not — caller's outer transaction
     * provides the atomic boundary).
     */
    private createInTransactionalContext;
    private validateReplyTo;
    /**
     * Transactional handoff: close the source qitem (state=done,
     * closure_reason=handed_off_to) and create a new qitem owned by `toSession`,
     * with `handed_off_from` recording the chain. One atomic transaction.
     */
    handoff(input: QueueHandoffInput): Promise<{
        closed: QueueItem;
        created: QueueItem;
    }>;
    /**
     * Variant of {@link handoff} that closes the source qitem as `done`
     * (terminal closure) instead of `handed-off` (intermediate). Same atomic
     * close+create, same chain_of_record semantics, same default-nudge behavior.
     * Use when the source seat is fully complete with the work — no follow-up
     * tracking needed against the source qitem.
     */
    handoffAndComplete(input: QueueHandoffAndCompleteInput): Promise<{
        closed: QueueItem;
        created: QueueItem;
    }>;
    /**
     * OPR.0.4.6.MH3 FR-4 (C2, arch Q-c): the LOCAL half of a cross-host
     * handoff — close the source row AFTER the successor-create was forwarded
     * to (and accepted by) the target host. The two sides live in two DBs, so
     * this is deliberately NOT the atomic close+create of {@link handoff}: the
     * boundary is bridged by message-passing (successor-create FIRST on the
     * origin host, this source-close SECOND — never the reverse, so a crash
     * between the two leaves a live duplicate the idempotent re-drive
     * converges, never a dropped potato).
     *
     * Re-drive semantics (FR-4/FR-5, the interrupted-close case):
     *   - source already terminal WITH a MATCHING closureTarget → idempotent
     *     absorb: return the stored row unchanged (`absorbed: true`) — no
     *     second close, no second event.
     *   - source already terminal with a MISMATCHED closureTarget → structured
     *     `cross_host_close_conflict` (someone else closed it meanwhile —
     *     surface, never overwrite).
     *   - otherwise → close exactly like the local handoff's close leg:
     *     `closure_reason=handed_off_to`; `closure_target` carries the
     *     host-qualified successor key `<qitem-id>@<host>` (custody metadata,
     *     never a local lookup key); `handed_off_to`
     *     stays the two-part `member@rig` (BR-1 — session-string carriers
     *     never gain `@host`).
     */
    closeCrossHostHandoffSource(input: {
        qitemId: string;
        fromSession: string;
        /** Two-part `member@rig` destination — the session-string carrier (BR-1). */
        toSession: string;
        /** Host-qualified successor `<qitem-id>@<host>` closure target. */
        closureTarget: string;
        /** `handed-off` for /handoff; `done` for /handoff-and-complete. */
        terminalState: "handed-off" | "done";
        transitionNote?: string;
        /** The sender's recorded provenance, as the local handoff records it. Null only for an in-process caller. */
        identityProvenance?: string | null;
    }): {
        item: QueueItem;
        absorbed: boolean;
    };
    /**
     * `whoami` — return the seat's queue position from the daemon's perspective.
     * Counts active qitems (pending + in-progress + blocked) destined for the
     * caller, lists the most recent active qitems, and reports counts for the
     * caller's outgoing source role too. Read-only; no mutations.
     *
     * Per PL-004 Phase A § Routes: GET /api/queue/whoami.
     */
    whoami(session: string, opts?: {
        recentLimit?: number;
    }): {
        session: string;
        asDestination: {
            pending: number;
            inProgress: number;
            blocked: number;
            recent: QueueItem[];
        };
        asSource: {
            total: number;
        };
    };
    /**
     * Every in-progress row destined for `session`, UNBOUNDED and single-state.
     *
     * `whoami`'s `recent` is a display projection: it is capped (default 25, max 200) and
     * mixes pending/in-progress/blocked. Anything that must reason about how many batons a
     * seat truly holds — in particular a refusal that fires on ambiguity — cannot read it,
     * because a second in-progress row sitting past the cap is invisible and the refusal
     * silently degrades into a confident answer. This is that authoritative input.
     */
    listInProgressForDestination(session: string): QueueItem[];
    /**
     * Mark a qitem `in-progress` (claim). Computes closure_required_at from tier.
     */
    claim(input: QueueClaimInput): QueueItem;
    unclaim(qitemId: string, destinationSession: string, reason: string, identityProvenance?: string | null): QueueItem;
    /**
     * General state mutator. Routes through hot-potato strict-rejection on
     * `done` transitions. All transitions append to the log.
     *
     * Phase B R2: emits queue.updated event atomically with the UPDATE +
     * transition log append, so the view-event-bridge can wake SSE consumers
     * on /api/views/:name/sse for normal state transitions (pending → blocked,
     * in-progress → done, closure, escalation). Phase A write semantics are
     * UNCHANGED — only an additional event emission inside the existing
     * transaction. This is an explicit narrow event-only extension to a
     * Phase A write surface so update-path mutations are visible to the
     * view bridge.
     */
    update(input: QueueUpdateInput): QueueItem;
    /**
     * PL-004 Phase D extension point (orch-ratified per slice IMPL Driver
     * Handoff Contract / Guard R1 repair). Same closure validation +
     * UPDATE + transition log + queue.updated event as update(), but
     * runs inside the caller's outer db.transaction so it composes with
     * workflow-projector's transactional-scribe contract.
     *
     * Caller MUST:
     *   1. Invoke from inside a `db.transaction(() => {...})` block.
     *   2. After the outer txn commits, call:
     *        eventBus.notifySubscribers(persistedEvent)
     *   3. NOT call this from outside a transaction (will produce a
     *      half-state if the caller errors before committing).
     *
     * Closure validation runs at call time (before the UPDATE) so a
     * Phase A invariant violation (e.g., state=done without closure_reason)
     * throws before the workflow projector's outer transaction can commit
     * any partial state. The Phase A hot-potato strict-rejection rule
     * therefore applies to workflow projection unchanged.
     */
    updateWithinTransaction(input: QueueUpdateInput): {
        qitemId: string;
        persistedEvent: PersistedEvent;
        persistedEvents: PersistedEvent[];
    };
    /** Internal read-only audit pointer for non-state receipts. Never search past a state write. */
    retainedClaimBlocker(qitemId: string): string | undefined;
    /**
     * Internal: closure validation + UPDATE + transition log + emit
     * queue.updated event. Caller is responsible for transaction wrapping
     * (the public update() wraps; the public updateWithinTransaction()
     * composes inside the caller's outer transaction).
     */
    private updateInTransactionalContext;
    /** OPR.0.5.6.26 — THE ONE PROPAGATION SITE. blocked_on promises "A waits until B
     *  completes"; every terminal closure of a blocker actuates the attached rows'
     *  auto-unpark through THIS helper — the update path and the handoff family both
     *  call it inside their own transactions. The class this unifies away was
     *  per-code-path: the handoff verbs wrote terminal states via direct SQL and the
     *  promise never fired for them. Never a second copy of this logic. */
    /**
     * OPR.0.5.8.1 S1b — retire the timer a park generated for this row.
     *
     * THE SINGLE PLACE THIS DECISION IS MADE. `queue_items.state` is written by
     * SIX methods, not one, and the first version of this repair only hooked the
     * generic `updateInTransactionalContext`. Every other writer silently kept the
     * timer alive — including `handoff()`, which is the exact route that produced
     * the motivating specimen (review50-r2 found that one; enumerating the rest
     * found `claim()` and `propagateBlockerCompletion()` too, and `claim()` is the
     * "claim-resume" the story contract named explicitly).
     *
     * Callers must invoke this inside their own state-transition transaction, so a
     * row can never be observed out of its park with a live park timer.
     *
     * Only park-GENERATED timers are retired. A watchdog the operator attached with
     * `--wake-watchdog` is theirs, may target other rows, and always survives.
     * Non-live jobs are left alone, so calling this twice is harmless.
     */
    private retireParkGeneratedTimer;
    private propagateBlockerCompletion;
    getParkWakeStatus(qitemId: string): ParkWakeStatus | null;
    /** For parked diagnosis only (see QueueWakeRepository.servedByOwnRepeatingReminder). */
    parkWakeServedByOwnReminder(qitemId: string): boolean;
    /** Park timers a seat swap keeps: each is still its blocked row's current wake and still targets the
     *  row's owner (see QueueWakeRepository.currentParkTimerIds). */
    currentParkTimerIds(): string[];
    /** Generated jobs end when neither their original park nor an unfired
     *  attachment still owns them. Standalone operator jobs keep their lifecycle. */
    resolveWatchdogPreDeliveryTerminalReason(jobId: string): string | null;
    /** OPR.0.7.0.12 — the current park's recorded continuation, bounded (see the transition log). */
    currentParkContinuation(qitemId: string): string | null;
    listTransitions(qitemId: string): Array<ReturnType<QueueTransitionLog["listForQitem"]>[number] & {
        wake?: ReturnType<QueueWakeRepository["getForTransition"]>;
    }>;
    /** The transition that closed a row: the first of the trailing run in its current closed state.
     *  Later notes and delivery receipts on a closed row repeat that state, so the latest transition
     *  is not the close. Null while the row is still active (pending, in-progress, blocked). */
    closingTransition(qitemId: string, currentState: string): ReturnType<QueueTransitionLog["listForQitem"]>[number] | null;
    /** Read-only scope-aware RECENT projection. Normalization and its hard cap
     * live with the append-only transition log; the repository owns the public
     * queue-domain door. */
    listRecentTransitions(scope: RecentQueueTransitionScope | string, limit?: number): ReturnType<QueueTransitionLog["listRecent"]>;
    /** Called by the watchdog engine after the delivery attempt is durably
     *  audited. The queue transition records that attempt independently of
     *  whether the HELD row's owner consumed it. */
    recordWatchdogWakeAttempt(jobId: string, deliveryStatus: string): void;
    /** Close a direct human request and retain its typed answer in the same transaction.
     * A thread reply has no question id: store it under the first unanswered question only,
     * preserving earlier clicks and leaving the other questions unanswered. A completed
     * button set is already final; its resolve continuation must not overwrite those answers.
     */
    resolveDirectHumanReply(input: {
        qitemId: string;
        actorSession: string;
        decision: string;
    }): boolean;
    /**
     * #193 — record one clicked answer on a pending decision that carries structured questions.
     * Only the decision's own human may answer, and only while it is pending. A click may change
     * an earlier answer until the set is complete; from then on the answers are FINAL, and any
     * further click returns them unchanged so the caller can retry the continuation (reply row +
     * resolve) with exactly what the seat will read. Anything else is not-applicable (a forged
     * id, a stranger, a decision already resolved), never an error the socket must retry.
     */
    recordHumanAnswer(input: {
        qitemId: string;
        actorSession: string;
        questionId: string;
        optionId: string;
    }): RecordHumanAnswerResult;
    getById(qitemId: string): QueueItem | null;
    /** #96 — the thread choice the daemon recorded before this replyTo update's first post;
     *  null = not yet chosen. Only an in-process daemon write counts: any HTTP write carries an
     *  identity provenance (and its actor is caller-asserted), so a note from there could forge
     *  a thread and is ignored. */
    replyToChoiceFor(qitemId: string): ReplyToChoice | null;
    /** #96 — whether some update recorded this Slack root as the thread it posts into. Such a
     *  root is shared: its owner's next decision must not reuse it (see slack-subsystem). */
    isReplyToThread(threadTs: string): boolean;
    private replyToFallbackFor;
    /** The parked query's obligation face: open rows to one destination, newest first, without the per-row
     *  projections list() derives (pickup, waiting view, delivery ledger), which this read never uses. */
    listOpenObligations(destinationSession: string, limit: number): Array<{
        qitemId: string;
        state: "pending" | "in-progress" | "blocked";
        summary: string | null;
    }>;
    list(opts: QueueListOptions & {
        compact: true;
    }): CompactQueueItem[];
    list(opts?: QueueListOptions & {
        compact?: false;
    }): QueueItem[];
    list(opts?: QueueListOptions): Array<QueueItem | CompactQueueItem>;
    /**
     * OPR.0.3.2.20 — durable attention-class query.
     *
     * Returns OPEN attention-class qitems (the source of truth for the
     * For You Action-required + Approval lenses) by pushing the
     * attention predicate INTO the SQL WHERE clause so the LIMIT
     * applies AFTER attention filtering. This makes the result
     * window-INDEPENDENT by construction: an old human-gate item
     * cannot be evicted past LIMIT by routine open qitems even when
     * there are >>LIMIT of them. (Guard verdict qitem-20260518190827
     * BLOCKER 1 — the prior fetch-then-filter approach in the route
     * could still hide attention items behind ATTENTION_FETCH_BOUND
     * newer routine open qitems.)
     *
     * Attention predicate in SQL (mirror of mission-control read
     * layer + the route-level `isAttentionItem`):
     *   tier = 'human-gate'                              (approval)
     *   OR destination_session matches human-seat regex  (action-required)
     *
     * SQLite has no native regex; LIKE patterns are used as a
     * SUPER-SET (every regex match also matches one of the LIKE
     * patterns). Callers can refine in JS with isAttentionItem if
     * they need strict regex semantics — but for the LIMIT-pushdown
     * guarantee, the SQL superset is what matters: NO attention item
     * is filtered out by the SQL stage.
     *
     * Default open state set: pending|in-progress|blocked. Caller may
     * override via `state`.
     */
    /** Delivered informational records remain queryable after closure. Receipt filtering
     * happens before LIMIT; no prose/tier classifier and no second event store. */
    listDeliveredHumanUpdates(opts?: {
        limit?: number;
    }): Array<QueueItem & {
        deliveredAt: string;
        deliveryReceipt: string;
    }>;
    listAttention(opts?: {
        limit?: number;
        state?: QueueState | QueueState[];
        destinationSession?: string;
        sourceSession?: string;
        targetRepo?: string;
    }): QueueItem[];
    /** The compact listings' columns: the shared set plus the summary, which is short and is what people search for. */
    private compactColumns;
    /**
     * Find qitems whose `closure_required_at` is past now. Used by watchdog;
     * does NOT itself emit events — callers decide whether to nudge or escalate.
     *
     * Slice 15 (finding 2): optionally rig-scoped, limited, and compact — mirroring
     * `list` — so `rig queue overdue` is bounded and body-free by default instead of
     * dumping every rig's full qitem bodies to a single caller. No args = the prior
     * behavior (all overdue, full rows) for the watchdog.
     */
    findOverdue(opts: FindOverdueOptions & {
        compact: true;
    }): CompactQueueItem[];
    findOverdue(opts?: FindOverdueOptions & {
        compact?: false;
    }): QueueItem[];
    findOverdue(opts?: FindOverdueOptions): Array<QueueItem | CompactQueueItem>;
    /**
     * Record that an in-progress queue item has exceeded its closure_required_at
     * deadline, appending a transition note and emitting `qitem.closure_overdue`.
     *
     * Deduplicated: if this obligation has already recorded `closure-overdue`
     * since it was claimed (or created), no duplicate event or transition is emitted.
     */
    recordClosureOverdue(qitemId: string, opts?: {
        now?: string;
    }): PersistedEvent | null;
    /**
     * Surface two evidence-backed undelivered classes: the original pending
     * create-path nudge failures, and active human-notification episodes whose
     * gateway ledger says transport-failed or receiptless past the post window.
     * A generic null nudge is still excluded; only a structured OWNER episode
     * makes that absence meaningful. READ only — no retry or unwind.
     */
    findUndelivered(opts: FindUndeliveredOptions & {
        compact: true;
    }): CompactQueueItem[];
    findUndelivered(opts?: FindUndeliveredOptions & {
        compact?: false;
    }): QueueItem[];
    findUndelivered(opts?: FindUndeliveredOptions): Array<QueueItem | CompactQueueItem>;
    /** OPR.0.5.6.14 — the one destination-classification seam, as the wake path consults it.
     *  Public for the single-row read route; getById itself stays free of topology reads. */
    classifyDestinationOf(destinationSession: string): DestinationClass;
    /** OPR.0.5.6.14 — terminal transport is a CAPABILITY, not topology presence.
     *  An exact session or composed canonical seat is pane-bound only when its
     *  node carries an explicit tmux binding. external_cli is paneless and must
     *  continue to the human-registry/gateway leg. FAIL-OPEN only where the DB
     *  cannot carry classification evidence (empty/partial bootstrap schemas). */
    private hasTerminalTransport;
    /** Null means legacy/no OWNER history; inactive means OWNER history exists
     *  but the row no longer projects a current human-notification episode.
     *  owners: the row's owner notifications, newest first. */
    private currentDeliveryEpisode;
    /** OPR.0.5.6.14 — derive the current episode's delivery ledger. Receipt
     *  transitions are same-row but keyed by qitemId:OWNER-transitionId; an old
     *  posted receipt cannot mask a later human park. Legacy pre-OWNER or literal
     *  external rows retain their row-scoped fallback. */
    deliveryOutcomeFor(qitemId: string): {
        outcome: "posted" | "transport-failed" | "never-posted";
        detail: string;
    } | null;
    /** #514 — true only when this row's CURRENT human-notification episode (OWNER history addressed
     *  to a registered human, aliases included) has a POSTED receipt. Legacy rows with no OWNER
     *  history, inactive episodes, never-posted and transport-failed all read false. Same derivation
     *  as deliveryOutcomeFor; it reads row fields, never the waiting view. */
    humanNotificationPostedThisEpisode(qitemId: string, listed?: ListedLedger): boolean;
    /** owners: the row's owner notifications as ownerNotificationsForQitems gives them, when the caller read them. */
    private deliveryLedger;
    private receiptNotesStatement?;
    /** The delivery ledger of each row, its reads batched: one read of the rows' owner notifications (unless the caller
     *  read them already), one of their receipts, the human registry loaded once at most. A single row's
     *  (deliveryOutcomeFor, show, the sweeps) is a batch of one. receiptsAfterEpisodes: read the receipts once the
     *  episodes (and so the registry) are worked out, as a single row's ledger does; a listing reads them before. */
    private deliveryOutcomesFor;
    /** The delivery receipt notes of these qitems, newest first, by qitem. */
    private receiptNotesFor;
    /** The ledger of one row's current episode, from its receipt notes (newest first). */
    private ledgerOf;
    /** The grace window before a receiptless gateway-routed row honestly reads
     *  never-posted (the connector sweep cadence bounds normal posting latency). */
    static readonly NEVER_POSTED_WINDOW_MS = 120000;
    recordNudgeAttempt(qitemId: string, result: string): void;
    /**
     * Where, in the row's `resolution`, the fallback line `routeToFallback` last wrote begins; null when it cannot be
     * told, and the field is then left whole. The row's own transitions say what that reroute printed: a newest-first
     * seek by row on the live log, then on the archive the retention sweep moves an aged closed row's transitions to,
     * stopping at the reroute's own transition (the in-process one, with no identity provenance), whose note is `fallback-routed: <from> → <to> (<reason>)`. The line is
     * `fallback: <reason>`, built from the same printed reason, so it starts at a line start `i` of the field with
     * `fallback: ` there and the rest of the field, `r`, satisfying note ends with ` (r)`. Neither the destinations nor
     * the chain are consulted, so how a value was stored cannot matter. At most one `i` can satisfy it when the field
     * ends with that line: a longer `r` would have to be preceded in the note by ` (`, and a shorter one starts inside the
     * reason, right after a newline, which is not ` (`.
     *
     * A close that came after that reroute from an open state may have appended an outcome behind the line, and an
     * outcome can read like the line, so then only a field that is nothing but the line (`i` = 0, which an appended
     * outcome would lengthen) is accepted.
     */
    private fallbackLineStart;
    /**
     * Pod-fallback: redirect qitem to a fallback destination (e.g., when a seat
     * is unreachable). Emits qitem.fallback_routed; preserves chain_of_record.
     */
    routeToFallback(qitemId: string, fallbackDestination: string, reason: string): QueueItem;
    private getByIdOrThrow;
    /** OPR.0.4.1.18 — persist the optional human-readable summary additively.
     *  Guarded by detectQueueColumn so fixtures on a pre-044 schema (no summary
     *  column) are unaffected; only writes when a value is present (NULL is the
     *  default and degrades in the Story consumer). Runs inside the caller's
     *  transaction (create / handoff / handoff-and-complete). */
    private persistSummary;
    /** OPR.0.4.4.19 FR-5 — persist the optional evidence_ref additively, same
     *  contract as persistSummary (pre-048 fixtures degrade; NULL default). */
    private persistEvidenceRef;
    /** GHOST-STAGE (e/Class-B) — persist the MINTING occupant-generation additively (same degrade
     *  contract as persistSummary; NULL when unresolved/pre-063). Forensic provenance of the creator;
     *  the RELEASE discriminator is claimed_by_generation_uuid (stamped at claim), not this. */
    private persistMintingGeneration;
    /**
     * GHOST-STAGE (e/Class-B) — at a seat swap, RELEASE (never hard-drop) every in-progress item CLAIMED
     * by the RETIRING generation back to pending: the role work is durable and the successor re-claims it;
     * only the retiree's stale claim is the ghost. Gen-scoped via claimed_by_generation_uuid (NOT the seat
     * name — the successor shares it, so a name-scoped release would steal the successor's own claims). A
     * NULL/empty generation never matches (UNKNOWN != retired). Clears the claim stamp + claimed_at and
     * appends an audit transition per item. Returns the count released. Pre-063 dbs no-op.
     */
    releaseClaimsByGeneration(retiringGeneration: string): number;
    private activityReader?;
    attachActivityReader(reader: WaitingActivityReader): void;
    private workflowGuidance?;
    attachWorkflowGuidance(reader: (packetId: string) => string[]): void;
    evaluateWaitReminder(input: {
        jobId: string;
    }): import("./policies/types.js").PolicyEvaluation | null;
    ownerActivity(session: string): ReturnType<WaitingActivityReader>;
    /** listed: the row's owner notifications and ledger, when a listing read them for all its rows. */
    waitingView(qitemId: string, listed?: ListedLedger): WaitingView | null;
    private handoffAdvisory;
    private rowToItem;
}
type DeliveryLedger = {
    outcome: "posted" | "transport-failed" | "never-posted";
    detail: string;
    episode: {
        notificationKey: string;
        startedAt: string;
    } | null;
};
/** A listed row's owner notifications (newest first) and its delivery ledger, read once for the whole listing. */
type ListedLedger = {
    owners: QueueTransition[];
    ledger: DeliveryLedger | null;
};
export {};
//# sourceMappingURL=queue-repository.d.ts.map