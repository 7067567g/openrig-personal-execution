/** The only actor whose choice note is trusted: an agent can append any transition note, so
 *  a note from anyone else must never steer where the update posts. */
export declare const REPLY_TO_CHOICE_ACTOR = "daemon@kernel";
/** Fallbacks named by the queue item that blocked threading. */
export type ReplyToQitemFallbackReason = "root-missing" | "reference-has-live-gate" | "chain-too-long";
/** Fallbacks named by the Slack root that could not be reused. */
export type ReplyToRootFallbackReason = "root-closed" | "root-other-human" | "root-other-seat" | "root-other-channel";
export type ReplyToFallback = {
    kind: "fallback";
    reason: ReplyToQitemFallbackReason;
    qitemId: string;
} | {
    kind: "fallback";
    reason: ReplyToRootFallbackReason;
    threadTs: string;
};
/** `channel` (#192): the channel the choice was made for, recorded only when a channel map is
 *  configured. Every retry posts there; a record without it resolves the channel as before. */
export type ReplyToChoice = ({
    kind: "thread";
    threadTs: string;
} | ReplyToFallback) & {
    channel?: string;
};
export declare function formatReplyToChoice(choice: ReplyToChoice): string;
/** Parse a choice note (null when the note is not one). Callers check the actor. */
export declare function parseReplyToChoice(note: string): ReplyToChoice | null;
/** The human-readable fallback line the verify result carries. */
export declare function describeReplyToFallback(choice: ReplyToFallback): string;
//# sourceMappingURL=reply-to-choice.d.ts.map