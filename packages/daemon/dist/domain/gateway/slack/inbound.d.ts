import type { SeenStore, DeadLetterStore } from "./state-store.js";
import type { InboundQueuePort } from "./queue-access.js";
import { type RecordHumanAnswerResult } from "../../human-questions.js";
export interface SlackEvent {
    type?: string;
    subtype?: string;
    user?: string;
    bot_id?: string;
    text?: string;
    ts?: string;
    /** S10 thread routing: present on a threaded reply (= the PARENT root's ts). Absent on a
     *  top-level channel message. The affordance discriminator: thread_ts==ts parent,
     *  thread_ts!=ts reply, absent plain. */
    thread_ts?: string;
    channel?: string;
    files?: unknown[];
    /** #899 — a `reaction_added` event: the emoji name, the message it was added to, and when. */
    reaction?: string;
    item?: {
        type?: string;
        channel?: string;
        ts?: string;
    };
    event_ts?: string;
    /** Internal history provenance, retained across dead-letter retry. */
    recoveredAfterGap?: boolean;
}
/** #193 — the parts of a Socket Mode `block_actions` payload (a button click) we read. */
export interface SlackBlockActions {
    type?: string;
    user?: {
        id?: string;
    };
    channel?: {
        id?: string;
    };
    container?: {
        message_ts?: string;
        thread_ts?: string;
        channel_id?: string;
    };
    message?: {
        ts?: string;
        thread_ts?: string;
    };
    actions?: Array<{
        block_id?: string;
        action_id?: string;
        value?: string;
        action_ts?: string;
    }>;
}
export type RecordHumanAnswer = (input: {
    qitemId: string;
    actorSession: string;
    questionId: string;
    optionId: string;
}) => RecordHumanAnswerResult;
/** What a person reads in the thread when OpenRig refuses a click or can't record it. Plain words: what happened, and
 *  who may answer or what to do instead. The same clicks are refused as before; they just aren't silent. */
export declare const CLICK_REPLIES: {
    readonly unregistered: "This click wasn't recorded: only the person this decision was sent to can answer it, and your Slack account isn't registered with this OpenRig.";
    readonly unmapped: "This click wasn't recorded: OpenRig can't find the decision this message belongs to. Reply in this thread in words instead.";
    readonly closed: "This decision is no longer waiting for answers, so this click wasn't recorded.";
    readonly onRecord: "Your answer is recorded, and this decision is no longer waiting for answers.";
    readonly someoneElse: "This click wasn't recorded: this decision was sent to someone else, and only they can answer it.";
    readonly stale: "This click wasn't recorded: the button no longer matches this decision's questions. Reply in this thread in words instead.";
    readonly unavailable: "This click wasn't recorded: OpenRig couldn't record a button answer here. Reply in this thread in words instead.";
    readonly notClosed: "Your answers were recorded and sent to the agent that asked, but the decision itself didn't close.";
};
/** The reply for a click recordHumanAnswer didn't record, by its reason. */
export declare function clickNotRecordedReply(reason: string): string;
/** The root message a click was made on: buttons live on the decision's root post, whose ts is
 *  the thread map's key (a click inside a thread would carry that thread's root instead). */
export declare function clickedRootTs(payload: SlackBlockActions): string | undefined;
export type InboundDisposition = "accepted" | "ignored" | "refused" | "dead-lettered" | "handler-failed";
/**
 * Loop-safety + non-ingestible ignore. Ingest genuine human messages — text,
 * and (OPR.0.5.6.2, replacing the T1076 v1 ignore) file-bearing drops: a
 * `file_share` subtype with files[] is THE shape a human upload arrives as,
 * and a pure drop legitimately has no caption, so empty text is admissible
 * when files are present. Loop safety is untouched: bot posts and every other
 * subtype (edits/joins) stay rejected, and a false return remains a clean
 * skip, never a crash or partial ingestion.
 */
/** P28 — the rejection BRANCH, as data. The ignore path used to log type/subtype/files, which
 *  are precisely the fields that have all PASSED when a message dies on bot_id or on
 *  missing-user/empty-text — so a silent discard could not be explained, and with `channels:read`
 *  ungranted there was no read that could even name the source conversation. This is the SINGLE
 *  definition of the ingest decision; `shouldIngest` is a thin wrapper over it so the branch logic
 *  has one origin and the log can never drift from the behaviour it describes.
 *  ("files" left the union at OPR.0.5.6.2: file-bearing events are now work, not noise.) */
export type IngestReason = "type" | "bot_id" | "subtype" | "no-user" | "empty-text" | "reaction-target";
export declare function ingestDecision(ev: SlackEvent): {
    ingest: true;
} | {
    ingest: false;
    reason: IngestReason;
};
/** OPR.0.5.6.2 — the inbound file-transfer PORT: injected so this core stays
 *  pure/testable; the subsystem wires the real download+store implementation
 *  (see makeInboundFilePort). Results are per-file and NAMED both ways. */
export interface StoredInboundFile {
    name: string;
    localPath: string;
    mimetype?: string;
    bytes: number;
}
export interface FailedInboundFile {
    name: string;
    error: string;
}
export interface InboundFileResult {
    stored: StoredInboundFile[];
    failed: FailedInboundFile[];
}
export interface InboundFilePort {
    transfer(files: unknown[], eventTs: string, eventChannel?: string): Promise<InboundFileResult>;
}
export declare function shouldIngest(ev: SlackEvent): boolean;
/** A6 v3: the sender-admission verdict. An inbound Slack message may become a human-provenance
 *  qitem ONLY if its sender resolves to a REGISTERED human (admit-iff-registered); the stamped
 *  `source` is that human's canonical ref (never a raw platform id). An unregistered sender — or a
 *  registry that itself failed to load — is REFUSED with LOUD teaching, never a fabricated seat. */
export type InboundSenderResolution = {
    admitted: true;
    source: string;
} | {
    admitted: false;
    teaching: string;
};
export interface InboundDeps {
    queue: InboundQueuePort;
    seen: SeenStore;
    deadLetter: DeadLetterStore<SlackEvent>;
    destination: string;
    /** A6 v3 registration gate. Resolves ev.user -> a registered human (or refuses). Injected so
     *  this core stays pure/testable; the subsystem wires it via the daemon human-registry resolver. */
    resolveSender: (slackUserId: string) => InboundSenderResolution;
    /** S10 thread routing (deterministic, zero inference): resolve the destination + tags for an
     *  admitted event. Absent → every event lands on the static `destination` (the pre-routing
     *  shape, and the fallback the tests pin). */
    resolveRoute?: (ev: SlackEvent) => {
        destination: string;
        tags?: string[];
        correlationQitemId?: string;
    };
    /** Continue an exact human gate through the existing Mission Control resolve primitive. */
    resolveHumanReply?: (input: {
        qitemId: string;
        actorSession: string;
        decision: string;
    }) => Promise<"resolved" | "already-resolved" | "not-applicable">;
    /** #193 — record a clicked answer on the decision the clicked message belongs to. */
    recordHumanAnswer?: RecordHumanAnswer;
    /** #193 — clicks whose continuation (reply row + resolve) failed; retried with the event
     *  dead-letters. Absent → a failed click is only logged. */
    actionDeadLetter?: DeadLetterStore<SlackBlockActions>;
    /** #193 — tell the human in the decision's thread what a click did. Best-effort; false when the post failed. */
    acknowledgeAnswer?: (input: {
        channel?: string;
        threadTs: string;
        text: string;
    }) => Promise<boolean | void>;
    /** OPR.0.5.6.2 — inbound file transfer. Absent with a file-bearing event →
     *  every file is a NAMED failure on the row ("transfer unavailable"), never
     *  a silent drop of message or file. */
    files?: InboundFilePort;
    sourceLabel?: string;
    log?: (msg: string) => void;
}
export declare class InboundRouter {
    private readonly deps;
    private readonly inflight;
    private readonly replyingTo;
    private retryPass;
    constructor(deps: InboundDeps);
    private summaryOf;
    /** Slack message ts is unique within a channel, so every inbound id uses both fields. */
    private inboundEventId;
    private inboundQitemId;
    /**
     * Core landing attempt — NO dead-letter side effect. Dedup by ts (in-flight +
     * durable seen). `reason` distinguishes a dedup skip from a genuine create
     * failure so callers dead-letter ONLY real failures. On success, marks seen
     * (durable qitem exists → safe).
     */
    private attemptLand;
    /**
     * LIVE path: attempt to land; on a genuine create failure, dead-letter the
     * event (attempt-counted) BEFORE returning — NOT marked seen (item 8).
     */
    route(ev: SlackEvent, attempts?: number, isCurrent?: () => boolean): Promise<{
        landed: boolean;
        qitemId?: string;
        disposition: "accepted" | "ignored" | "refused" | "dead-lettered";
        reason?: string;
        correlationQitemId?: string;
        replyResolution?: "resolved" | "already-resolved" | "not-applicable";
    }>;
    /**
     * #193 — a button click on a decision's structured questions. The clicked message is the
     * decision's root, so the same thread map a typed reply uses names the decision and its seat
     * (never the button's own ids, which only pick the question and option). Each click records
     * one answer; once the set is complete the answers are final, and the continuation lands one
     * reply row on the seat and resolves the decision, exactly like a typed reply. The reply row's
     * id is derived from the decision, so a redelivered click or a retry finds the same row. A
     * failed continuation is dead-lettered and retried like a typed reply that failed to land.
     */
    routeAction(payload: SlackBlockActions): Promise<{
        status: InboundDisposition;
        reason?: string;
    }>;
    /** The key a live click's one thread reply is recorded under: Slack can redeliver an envelope we already handled, and
     *  the person must not read a second reply, such as "already closed" after "All answered". The click's user and
     *  action_ts identify it; a click without an action_ts can't be told from its redelivery, so it replies as before. */
    private clickReplyKey;
    private attemptAction;
    /**
     * #899 — a reaction on an ask. The ask is the root message the thread map is keyed on, so the
     * lookup that routes a typed reply names the asking seat; a reaction on a message OpenRig posted
     * into a thread for an ask (a long ask's part, or an ask posted as a reply) names that ask's own
     * seat. The row carries the fact (who, which
     * emoji, which ask) and leaves its meaning to that seat: a reaction neither answers nor closes
     * the ask. A reaction on any other message is logged and ignored. The row id derives from the
     * reaction event, so a redelivery or a retry finds the same row; a failed create is
     * dead-lettered and retried like a message.
     */
    routeReaction(ev: SlackEvent, attempts?: number): Promise<{
        status: InboundDisposition;
        reason?: string;
    }>;
    private attemptReaction;
    /**
     * INTERRUPTION-SAFE retry (item 8): read the durable set NON-destructively,
     * attempt each, then ATOMICALLY replace the file with only the still-failing
     * entries. The original file stays intact until the atomic replace, so a crash
     * at any point loses nothing (a since-landed event is skipped via the seen-set).
     * Does NOT go through route() (which would double-append) — uses attemptLand.
     */
    retryDeadLetters(): Promise<{
        retried: number;
        landed: number;
    }>;
    private retryDeadLetterPass;
    /** #193 — retry dead-lettered clicks. Same interruption-safe shape as the event retry:
     *  read, attempt each, then atomically keep only the ones still failing. */
    private retryActionDeadLetters;
}
export interface SocketEnvelope {
    envelope_id?: string;
    type?: string;
    reason?: string;
    payload?: {
        event?: SlackEvent;
    } & SlackBlockActions;
}
/**
 * Handle one Socket Mode envelope. FAST-ACK first, ALWAYS (item 8: Socket Mode
 * punishes slow acks; transport redelivery is not the safety net). Then filter
 * and route. Ack happens even if routing later fails — the dead-letter, not
 * transport redelivery, is the zero-drop net.
 */
export declare function handleEnvelope(env: SocketEnvelope, ack: () => void, router: InboundRouter, log?: (m: string) => void, onReceived?: () => void): Promise<{
    status: InboundDisposition;
    reason?: string;
}>;
//# sourceMappingURL=inbound.d.ts.map