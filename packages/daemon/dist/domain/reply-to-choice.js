// #96 — the durable record of where a --reply-to update posts. It is written on the row
// ONCE, before the first post, so every retry, reconcile scan and --verify read the same
// choice instead of re-deriving it after the referenced item or its root may have changed.
const REPLY_TO_CHOICE_PREFIX = "slack-reply-to-choice";
/** The only actor whose choice note is trusted: an agent can append any transition note, so
 *  a note from anyone else must never steer where the update posts. */
export const REPLY_TO_CHOICE_ACTOR = "daemon@kernel";
const QITEM_REASONS = ["root-missing", "reference-has-live-gate", "chain-too-long"];
const ROOT_REASONS = ["root-closed", "root-other-human", "root-other-seat", "root-other-channel"];
export function formatReplyToChoice(choice) {
    const channel = choice.channel ? ` channel=${choice.channel}` : "";
    if (choice.kind === "thread")
        return `${REPLY_TO_CHOICE_PREFIX} kind=thread thread_ts=${choice.threadTs}${channel}`;
    return "qitemId" in choice
        ? `${REPLY_TO_CHOICE_PREFIX} kind=fallback reason=${choice.reason} qitem=${choice.qitemId}${channel}`
        : `${REPLY_TO_CHOICE_PREFIX} kind=fallback reason=${choice.reason} thread_ts=${choice.threadTs}${channel}`;
}
/** Parse a choice note (null when the note is not one). Callers check the actor. */
export function parseReplyToChoice(note) {
    if (!note.startsWith(REPLY_TO_CHOICE_PREFIX + " "))
        return null;
    const fields = new Map();
    for (const token of note.slice(REPLY_TO_CHOICE_PREFIX.length + 1).split(/\s+/)) {
        const eq = token.indexOf("=");
        if (eq > 0)
            fields.set(token.slice(0, eq), token.slice(eq + 1));
    }
    const kind = fields.get("kind");
    const reason = fields.get("reason") ?? "";
    const threadTs = fields.get("thread_ts");
    const qitemId = fields.get("qitem");
    const channel = fields.get("channel");
    const at = channel ? { channel } : {};
    if (kind === "thread" && threadTs)
        return { kind: "thread", threadTs, ...at };
    if (kind === "fallback" && qitemId && QITEM_REASONS.includes(reason)) {
        return { kind: "fallback", reason: reason, qitemId, ...at };
    }
    if (kind === "fallback" && threadTs && ROOT_REASONS.includes(reason)) {
        return { kind: "fallback", reason: reason, threadTs, ...at };
    }
    return null;
}
/** The human-readable fallback line the verify result carries. */
export function describeReplyToFallback(choice) {
    return "qitemId" in choice ? `${choice.reason} (qitem ${choice.qitemId})` : `${choice.reason} (thread ${choice.threadTs})`;
}
//# sourceMappingURL=reply-to-choice.js.map