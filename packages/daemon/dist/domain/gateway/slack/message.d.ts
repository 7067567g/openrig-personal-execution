import { type HumanQuestion } from "../../human-questions.js";
export declare const SLACK_TEXT_CAP = 3900;
export declare const SLACK_SECTION_CAP = 3000;
/** @deprecated Complete rendering ignores excerpt requests. */
export declare const DEFAULT_BODY_EXCERPT = 3000;
export interface QitemLike {
    qitemId: string;
    summary?: string | null;
    body?: string | null;
    destinationSession?: string | null;
    /** #193 — structured questions, rendered as one button row per question. */
    humanQuestions?: readonly HumanQuestion[] | null;
    /** #1013 — row state + tags, so a workflow gate PARKED on a human seat can be
     *  re-rendered for the person instead of posting the seat's agent packet. */
    state?: string | null;
    tags?: readonly string[] | null;
    /** #1013 — the structured evidenceRef: for a parked gate it rides the evidence link/media
     *  path when it is an https ref, else it renders as one Evidence line (never the packet). */
    evidenceRef?: string | null;
}
/** #1013 — a workflow gate row parked on a human seat (the projector parks it
 * `state=blocked, blocked_on=<human seat>` and tags it `gate`; every workflow gate also
 * carries the `workflow` tag — the projector and the runtime both set it). Agents also
 * put `gate` on rows they write by hand, so requiring both keeps a hand-tagged row's
 * own body intact. A gate's body is the agent packet — instance/step/Continuation lines
 * for the seat that resumes after sign-off — while the person needs only the headline
 * (`gate.summary`, plain language per C6) and the evidence link. The row itself is
 * untouched; this gates the OUTBOUND render only. */
export declare function isHumanGatePacket(q: Pick<QitemLike, "state" | "tags">): boolean;
/** M1 A5b — an outbound image attachment. A media-bearing OutboundDecision carries these;
 *  the connector renders each as a Slack Block Kit `image` block on the SHIPPED outbound path.
 *  This is the T1076 seam finally wired (Slice-12's image relay), not a redesign. */
export interface SlackMediaRef {
    imageUrl: string;
    altText: string;
}
export interface OutboundMessageOpts {
    sourceLabel: string;
    /** @deprecated Ignored: complete briefs are rendered or explicitly refused. */
    bodyExcerpt?: number;
    /** @deprecated Refused without an accessible projection; use mediaRefs. */
    extraBlocks?: unknown[];
    /** M1 A5b: outbound image attachments, rendered as Block Kit `image` blocks (the wired seam). */
    mediaRefs?: SlackMediaRef[];
    /** #47 — an https evidenceRef that is NOT an image (GitLab issue link, PROOF.md URL, …),
     *  rendered as a plain link in the message text + a context block. NEVER a Block Kit
     *  `image` block: Slack rejects the ENTIRE message with `invalid_blocks` when an image
     *  block's URL is not a real image, silently and permanently breaking delivery. */
    evidenceLink?: string | null;
    /** S10 / A1.2 — the structured seat-attribution header (rig/host/seat/session), rendered as
     *  one sender context line in ONE honest bot identity. Authorship lives in OUR record;
     *  Slack's transport actor stays the app. NEVER a per-message username/icon override. */
    attribution?: SeatAttribution;
    /** S10 interim loudness rule: an escalation MENTIONS its human (`<@Uxxx>`); everything else
     *  stays quiet-threaded. The value is the Slack USER ID (mention semantics require the id,
     *  never a display name). */
    mentionUserId?: string;
    /** Stable decision/part identity. Included in the complete fallback budget. */
    reconcileMarker?: string;
}
/** A1.2 — the four attribution fields. */
export interface SeatAttribution {
    seat: string;
    rig?: string;
    host?: string;
    session: string;
}
/** Parse the stamped session triple (`member@rig[@host]`, the 51-09 stored form) into the
 *  attribution fields. A bare/unparseable ref degrades to seat=session (never a throw). */
export declare function attributionFromSession(sourceSession: string | null | undefined): SeatAttribution | undefined;
/** M1 A5b — turn media refs into Block Kit `image` blocks. Item-7 hygiene: a secret-bearing
 *  image_url (e.g. a webhook URL smuggled as an image) is REFUSED, never forwarded. Alt text is
 *  redacted and validated without clipping. Returns only the well-formed, secret-free image blocks. */
export declare function buildImageBlocks(mediaRefs: readonly SlackMediaRef[] | undefined): unknown[];
/** #193 — the block_id / action_id prefixes a click carries back. The inbound path parses
 *  exactly these (one producer, one parser: see parseQuestionAction). */
export declare const QUESTION_BLOCK_PREFIX = "or-q:";
export declare const OPTION_ACTION_PREFIX = "or-opt:";
/** Parse a clicked button back into its question and option ids; null if it is not ours. */
export declare function parseQuestionAction(blockId: unknown, actionId: unknown): {
    questionId: string;
    optionId: string;
} | null;
export declare function containsSecret(text: string): boolean;
export declare function redactSecrets(text: string): string;
/** S10 fix-r1 (R2 B1) — STRUCTURAL neutralization of queue-controlled content. Slack's
 *  formatting contract parses control sequences (<@U…>, <!here>, <!channel>, <!subteam^…>,
 *  <url|label>) only from a literal "<"; its documented rule for displaying user-generated
 *  text is to escape exactly &, <, > (docs.slack.dev/messaging/formatting-message-text).
 *  Escaping these three makes EVERY control form inert BY CONSTRUCTION — present and past
 *  forms alike — never a blocklist of known spellings. Ordinary mrkdwn styling (*bold*,
 *  _italic_, bare URLs) uses none of the three and survives untouched. Order matters: "&"
 *  first, or the escapes themselves would be re-escaped. */
export declare function escapeSlackText(text: string): string;
/** S10 fix-r3 (R2 exactly-once) — the STRUCTURAL reconciliation identity: a bounded,
 *  decision-scoped token. decisionId is daemon-minted per decision (never settable through
 *  queue rows) and stable across retries of the same decision, so ONLY the target posted
 *  message carries this exact delimited token — ordinary prose quoting a qitem id (or even a
 *  lookalike built from the qitem id) cannot reproduce it. ONE producer function; the
 *  reconcile scanner matches exactly this function's output — producer and scanner share
 *  identity bytes by construction. Parentheses/colon only: no &,<,> so the token is
 *  escape-stable and never parses as Slack control syntax. */
export declare function reconcileToken(decisionId: string): string;
export interface SlackMessagePayload {
    text: string;
    blocks: unknown[];
}
export declare class HumanMessageShapeError extends Error {
    readonly code = "human_message_unrenderable";
}
/** #897 — split text into pieces that each fit `budgetFor(index)` once escaped, so a brief
 *  over one message's limit is posted as several messages instead of refused. Secrets are
 *  redacted before any cut, so a cut can never separate a secret from the pattern that finds
 *  it. A cut prefers a blank line, then a line end, then a space, in the second half of the
 *  room; it never falls inside a surrogate pair. The pieces join back to the redacted text
 *  without its trailing whitespace. */
export declare function splitForSlack(text: string, budgetFor: (index: number) => number): string[];
/** Longest tag value the gate context line shows, in characters, ellipsis included. */
export declare const GATE_CONTEXT_VALUE_CAP = 80;
/** PR #1143 review — the one-line workflow/instance context for a rendered human gate,
 * built from the row's own `workflow:` / `instance:` / `step:` tags. The step rides along
 * only when tagged. Missing tags render as `?` so the line never names the wrong workflow.
 * A hand-made row can carry a tag of any length, so each value is redacted, then shortened
 * (shortenGateValue), and only then is the line escaped, so no escape is split.
 * `instanceOnly` gives the shorter line that still tells two instances apart. */
export declare function buildGateContextLine(tags: readonly string[], instanceOnly?: boolean): string;
/** Pure, deterministic rendering. Queue metadata stays in the durable request;
 * the human sees one subject, complete body and one sender attribution. */
export declare function buildOutboundMessage(q: QitemLike, opts: OutboundMessageOpts): SlackMessagePayload;
//# sourceMappingURL=message.d.ts.map