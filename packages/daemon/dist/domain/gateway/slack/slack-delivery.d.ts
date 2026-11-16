import { type FetchImpl } from "./slack-api.js";
import { type SlackMediaRef } from "./message.js";
import type { SeenStore } from "./state-store.js";
import type { SubsystemDeliverFn } from "../gateway-subsystem.js";
import type { OutboundPostPayload } from "./outbound-driver.js";
export interface SubsystemSlackDeliveryOpts {
    botToken: string;
    /** The default channel: every post goes here unless resolveChannel names another. */
    channel: string;
    /** #192: the channel for this payload (the channel map). Absent = `channel` for every post.
     *  Post, reconcile scan and upload all use the one resolved channel. */
    resolveChannel?: (payload: OutboundPostPayload) => string;
    /** #192: decide a post's channel ONCE, at its first attempt, and record it in `attempted`;
     *  every retry or replay of that post reuses it, so the channel/thread pair always names one
     *  conversation and reconciliation scans where the first attempt went. A recorded channel is
     *  honoured whenever present. A post already attempted without a record (its first attempt ran
     *  before any map existed) retries in the default `channel`, where it went. With pinChannel off
     *  (no map) nothing is recorded and the channel is resolved as before. */
    pinChannel?: boolean;
    sourceLabel: string;
    bodyExcerpt?: number;
    fetchImpl?: FetchImpl;
    /** The owning gateway run's stop signal. When the wire stops (restart, disable,
     *  shutdown) a rate-limit wait inside postChatMessage rejects instead of sleeping
     *  on: a stale retry must never post after a replay already owns the decision. */
    stopSignal?: AbortSignal;
    /** decisionId-keyed delivered-store (idempotent redelivery: replay re-acks, never re-posts). */
    delivered: SeenStore;
    /** H — decisionId-keyed ATTEMPTED-store, marked BEFORE the HTTP post. A retry of an attempted
     *  decision has an AMBIGUOUS prior outcome (a timeout may have landed), so it RECONCILES by
     *  marker before any resend — never a blind repost. Distinct from `delivered` (proven 2xx). */
    attempted: SeenStore;
    /** Episode-keyed outbound seen-state (marked ONLY after a successful post). */
    outboundSeen: SeenStore;
    /** Release the outbound driver's in-flight guard once an episode is durably seen. */
    release?: (notificationKey: string) => void;
    /** E (thread routing): resolve the thread anchor for this payload; undefined = new root.
     *  Wired by the thread-seat map; absent in the pre-routing composition. `channel` is the
     *  channel this attempt posts to, so a thread is only ever chosen within it. */
    resolveThreadTs?: (payload: OutboundPostPayload, channel: string) => string | undefined;
    /** E: record a NEW root's ts (and the channel it was posted in) so the conversation threads
     *  from here on. */
    onPostedRoot?: (payload: OutboundPostPayload, ts: string, channel: string) => void;
    /** Receipt hook for every successful post, root or threaded. */
    onPosted?: (payload: OutboundPostPayload, messageTs: string, threadTs?: string) => void;
    /** #899 — receipt hook for every message posted (or reconciled) into a thread: a long ask's reply
     *  parts, a later notification in an ask's own thread, an ask posted into another thread. The payload
     *  names the ask and its seat, and `channel` the channel the message was posted to (#192), so a
     *  reaction on that message can reach them. A throw retains the
     *  delivery like any receipt failure; the replay reconciles the message by marker and records it again. */
    onPostedPart?: (payload: OutboundPostPayload, messageTs: string, threadTs: string, channel: string) => void;
    /** OPR.0.5.6.14 — the transport-failure receipt hook: a failed post writes
     *  the row's transport-failed ledger transition (class + API error), so a
     *  delivery failure is as legible on the row as a success. `partlyPosted` marks an ask whose
     *  remaining parts can't be posted although part of it may already be in Slack (#897). */
    onTransportFailed?: (payload: OutboundPostPayload, failureClass: string, detail: string, partlyPosted?: boolean) => void;
    /** F (interim loudness rule): return the Slack USER ID to mention for an ESCALATION payload,
     *  undefined for everything else (quiet-threaded). The composition wires the registry lookup
     *  + the escalation predicate; delivery just renders what it is told. */
    resolveMentionUserId?: (payload: OutboundPostPayload) => string | undefined;
    /** G — read a LOCAL file the evidenceRef points at (the founder screenshot class: a seat's
     *  file has no public URL, so it rides the EXTERNAL-UPLOAD flow into the thread). Injectable
     *  for hermetic tests; default reads the filesystem (LOCAL_ATTACHMENT_EXT, at most
     *  LOCAL_ATTACHMENT_MAX_BYTES). Return null = not a local attachment; { skipped } = an
     *  attachment that can't be sent (logged, the text still delivers). */
    readLocalImage?: (refPath: string) => LocalAttachment | null;
    log?: (msg: string) => void;
}
/** Well under Slack's 1 GB per-file limit, and bounded for a daemon that holds the bytes in memory. */
export declare const LOCAL_ATTACHMENT_MAX_BYTES: number;
export type LocalAttachment = {
    bytes: Uint8Array;
    filename: string;
} | {
    skipped: string;
};
/** Default local-attachment reader: an absolute path with an attachment extension, a regular file
 *  of at most LOCAL_ATTACHMENT_MAX_BYTES, readable — else null (not an attachment), or { skipped }
 *  when it is an attachment that can't be sent (too large, missing, unreadable), so the miss is
 *  logged rather than silent. */
export declare function defaultReadLocalImage(refPath: string): LocalAttachment | null;
/** #47 — only an https evidenceRef with an image-like extension may ride as a Block Kit
 *  `image` block (extension set mirrors LOCAL_IMAGE_EXT). Slack rejects the ENTIRE
 *  message with `invalid_blocks` when an image block's URL is not a real image (e.g. a
 *  GitLab issue link or a PROOF.md URL — both explicitly documented evidenceRef uses),
 *  so a non-image https ref must never become an image block. Query strings and
 *  fragments are stripped before the extension check. */
export declare function isHttpsImageRef(ref: unknown): boolean;
/** #47 — split an evidenceRef into an image attachment vs. a plain link. An explicit
 *  `media` array stays fully caller-controlled; otherwise an image-looking https
 *  evidenceRef becomes a Block Kit image and a non-image https evidenceRef becomes a
 *  plain link (rendered by buildEvidenceLink, never an image block). Local refs keep
 *  their existing handling (image upload flow / clean skip). */
export declare function evidenceAttachment(media: unknown, evidenceRef: unknown, summary: string | null | undefined): {
    mediaRefs: SlackMediaRef[] | undefined;
    evidenceLink: string | undefined;
};
/** A sleep that rejects the moment the owning gateway run stops: the inline rate-limit
 *  retry inside postChatMessage must never outlive the run that started it, or a restart
 *  would leave both the stale retry and the replay's post in flight for one decision. */
export declare function abortableSleep(ms: number, signal: AbortSignal): Promise<void>;
/** #897 — the most Slack messages one ask may post: the primary plus its thread replies. */
export declare const MAX_HUMAN_MESSAGE_PARTS = 20;
/** One authored primary and, optionally, one coherent supplemental reply; a brief or
 * detail too long for that is posted as more numbered thread replies (#897). The
 * existing attempted/delivered stores and marker reconciler own each stable part.
 * Preflight ALL parts before posting; the episode receipt is written only after
 * every required part. A restart retries missing parts and the final receipt. */
export declare function subsystemSlackDeliver(opts: SubsystemSlackDeliveryOpts): SubsystemDeliverFn;
//# sourceMappingURL=slack-delivery.d.ts.map