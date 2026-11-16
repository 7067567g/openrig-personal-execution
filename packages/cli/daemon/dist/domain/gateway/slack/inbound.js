import { createHash } from "node:crypto";
import { ADMITTED_EVENT_TYPES } from "./capabilities.js";
import { escapeSlackText, parseQuestionAction, redactSecrets } from "./message.js";
import { formatHumanAnswers, unansweredQuestions } from "../../human-questions.js";
/** What a person reads in the thread when OpenRig refuses a click or can't record it. Plain words: what happened, and
 *  who may answer or what to do instead. The same clicks are refused as before; they just aren't silent. */
export const CLICK_REPLIES = {
    unregistered: "This click wasn't recorded: only the person this decision was sent to can answer it, and your Slack account isn't registered with this OpenRig.",
    unmapped: "This click wasn't recorded: OpenRig can't find the decision this message belongs to. Reply in this thread in words instead.",
    closed: "This decision is no longer waiting for answers, so this click wasn't recorded.",
    onRecord: "Your answer is recorded, and this decision is no longer waiting for answers.",
    someoneElse: "This click wasn't recorded: this decision was sent to someone else, and only they can answer it.",
    stale: "This click wasn't recorded: the button no longer matches this decision's questions. Reply in this thread in words instead.",
    unavailable: "This click wasn't recorded: OpenRig couldn't record a button answer here. Reply in this thread in words instead.",
    notClosed: "Your answers were recorded and sent to the agent that asked, but the decision itself didn't close.",
};
/** The reply for a click recordHumanAnswer didn't record, by its reason. */
export function clickNotRecordedReply(reason) {
    if (reason.startsWith("state-"))
        return CLICK_REPLIES.closed;
    if (reason === "not-the-asked-human")
        return CLICK_REPLIES.someoneElse;
    if (reason === "unknown-option" || reason === "no-questions")
        return CLICK_REPLIES.stale;
    return CLICK_REPLIES.unavailable;
}
/** The root message a click was made on: buttons live on the decision's root post, whose ts is
 *  the thread map's key (a click inside a thread would carry that thread's root instead). */
export function clickedRootTs(payload) {
    return payload.container?.thread_ts ?? payload.message?.thread_ts ?? payload.container?.message_ts ?? payload.message?.ts;
}
export function ingestDecision(ev) {
    const hasFiles = Array.isArray(ev.files) && ev.files.length > 0;
    if (!ev.type || !ADMITTED_EVENT_TYPES.includes(ev.type))
        return { ingest: false, reason: "type" };
    if (ev.bot_id)
        return { ingest: false, reason: "bot_id" }; // never ingest our own / any bot post
    if (ev.type === "reaction_added") {
        // #899 — a reaction has no text; it is admitted when a person added it to a message, the
        // only target that can be an ask. Reactions to files or file comments stay ignored.
        if (!ev.user)
            return { ingest: false, reason: "no-user" };
        if (ev.item?.type !== "message" || !ev.item.ts || !ev.reaction)
            return { ingest: false, reason: "reaction-target" };
        return { ingest: true };
    }
    // OPR.0.5.6.2: `file_share` WITH files is the human-upload shape and is admitted.
    // #899: a thread reply sent with "Also send to #channel" arrives as `thread_broadcast`
    // and still carries its thread_ts, so it is admitted and routes like any thread reply.
    // Every other subtype (edits, joins, …) stays rejected exactly as before.
    const isThreadBroadcast = ev.subtype === "thread_broadcast" && !!ev.thread_ts && ev.thread_ts !== ev.ts;
    if (ev.subtype && !(ev.subtype === "file_share" && hasFiles) && !isThreadBroadcast)
        return { ingest: false, reason: "subtype" };
    if (!ev.user)
        return { ingest: false, reason: "no-user" };
    // A pure file drop has no caption: empty text is admissible iff files ride along.
    if ((!ev.text || !ev.text.trim()) && !hasFiles)
        return { ingest: false, reason: "empty-text" };
    return { ingest: true };
}
export function shouldIngest(ev) {
    return ingestDecision(ev).ingest;
}
export class InboundRouter {
    deps;
    inflight = new Set(); // same-channel message identity double-dispatch guard
    replyingTo = new Set(); // click replies being posted now
    retryPass;
    constructor(deps) {
        this.deps = deps;
    }
    summaryOf(ev, transfer, correlationQitemId) {
        const text = String(ev.text ?? "");
        const meta = `slack channel=${ev.channel} user=${ev.user} ts=${ev.ts}`;
        // OPR.0.5.6.2 — attachments ride the row BODY by LOCAL path (Slack owns
        // nothing; the media file is OUR copy). Failures are per-file and named:
        // the message always survives a failed transfer.
        const sections = [text];
        if (ev.recoveredAfterGap) {
            const posted = new Date(Number(ev.ts) * 1000).toISOString();
            sections.unshift(`Recovered after a gap (late delivery). Originally posted ${posted} (Slack ts ${ev.ts}).`);
        }
        if (transfer && (transfer.stored.length > 0 || transfer.failed.length > 0)) {
            const lines = [];
            if (transfer.stored.length > 0) {
                lines.push("Attachments (workspace-local copies):");
                for (const f of transfer.stored) {
                    lines.push(`- ${f.localPath} (${f.name}${f.mimetype ? `, ${f.mimetype}` : ""}, ${f.bytes} bytes)`);
                }
            }
            for (const f of transfer.failed) {
                lines.push(`FILE TRANSFER FAILED: ${f.name} — ${f.error}`);
            }
            sections.push(lines.join("\n"));
        }
        const firstFileName = transfer?.stored[0]?.name ?? transfer?.failed[0]?.name;
        const headline = text.trim() ? text : firstFileName ? `[file] ${firstFileName}` : text;
        return {
            summary: `${ev.recoveredAfterGap ? "[Recovered after gap] " : ""}Founder via Slack: ${headline.slice(0, 90)}`,
            body: `${sections.filter((s) => s.length > 0).join("\n\n")}\n\n---\nSource: ${meta}${correlationQitemId ? `\nIn reply to: ${correlationQitemId}` : ""}\nRouted by openrig slack-inbound. Default destination per config; re-route via queue as needed.`,
        };
    }
    /** Slack message ts is unique within a channel, so every inbound id uses both fields. */
    inboundEventId(ev) {
        return `${ev.channel ?? "-"}:${ev.ts ?? "-"}`;
    }
    inboundQitemId(ev) {
        return `qitem-slack-inbound-${createHash("sha256").update(this.inboundEventId(ev)).digest("hex").slice(0, 20)}`;
    }
    /**
     * Core landing attempt — NO dead-letter side effect. Dedup by ts (in-flight +
     * durable seen). `reason` distinguishes a dedup skip from a genuine create
     * failure so callers dead-letter ONLY real failures. On success, marks seen
     * (durable qitem exists → safe).
     */
    async attemptLand(ev, isCurrent = () => true) {
        const ts = ev.ts ?? "";
        const eventId = this.inboundEventId(ev);
        if (!ts || this.deps.seen.load().has(eventId))
            return { landed: false, reason: "dup" };
        if (this.inflight.has(eventId))
            return { landed: false, reason: "inflight" };
        if (!isCurrent())
            return { landed: false, reason: "inactive" };
        // A6 v3 registration gate: admit-iff-registered. An unregistered sender is REFUSED here —
        // never landed as a fabricated human-<slackid>@kernel seat. This is a POLICY refusal, not a
        // transient failure, so it is NOT dead-lettered (retrying can't help until the human registers).
        const who = this.deps.resolveSender(ev.user ?? "");
        if (!who.admitted) {
            this.deps.log?.(`inbound REFUSED — unregistered sender ${ev.user} (ts=${ts}): ${who.teaching}`);
            return { landed: false, reason: "unregistered" };
        }
        this.inflight.add(eventId);
        try {
            // OPR.0.5.6.2 — transfer the human's files BEFORE composing the row so the
            // row carries local paths (or named failures). A missing port is itself a
            // named per-file failure, never a silent drop.
            const fileMetas = Array.isArray(ev.files) ? ev.files : [];
            let transfer = null;
            if (fileMetas.length > 0) {
                const namedAll = (error) => ({
                    stored: [],
                    failed: fileMetas.map((f, i) => {
                        const m = (f ?? {});
                        return { name: String(m.name ?? m.id ?? `file-${i + 1}`), error };
                    }),
                });
                if (!this.deps.files) {
                    transfer = namedAll("file transfer unavailable (no file port wired)");
                }
                else {
                    // R1 F2: a THROWING port (disk-full mkdirp, any crash) must never cost
                    // the already-ACKed message — the row still lands and every file
                    // becomes a NAMED failure. Failure honesty is a property of this seam,
                    // not a promise the port is trusted to keep.
                    try {
                        transfer = await this.deps.files.transfer(fileMetas, ts, ev.channel);
                    }
                    catch (e) {
                        this.deps.log?.(`inbound file port CRASHED ts=${ts}: ${e.message}`);
                        transfer = namedAll(`file transfer crashed: ${e.message || "unknown error"}`);
                    }
                }
            }
            if (!isCurrent())
                return { landed: false, reason: "inactive" };
            // S10 — deterministic route (thread map) when wired; static destination otherwise.
            const route = this.deps.resolveRoute?.(ev) ?? { destination: this.deps.destination };
            const { summary, body } = this.summaryOf(ev, transfer, route.correlationQitemId);
            let qitemId;
            try {
                qitemId = await this.deps.queue.createQitem({
                    qitemId: this.inboundQitemId(ev),
                    source: who.source, // the REGISTERED human's canonical ref (human-class), never a raw platform id
                    destination: route.destination,
                    priority: "routine",
                    tags: route.tags ?? ["founder-slack", "inbound"],
                    summary,
                    body,
                    ...(route.correlationQitemId ? { inReplyTo: route.correlationQitemId } : {}),
                });
            }
            catch (e) {
                this.deps.log?.(`qitem create failed ts=${ts}: ${e.message}`);
                return { landed: false, reason: "create_failed" };
            }
            let replyResolution;
            if (route.correlationQitemId && this.deps.resolveHumanReply) {
                try {
                    replyResolution = await this.deps.resolveHumanReply({
                        qitemId: route.correlationQitemId,
                        actorSession: who.source,
                        decision: String(ev.text ?? "").trim() || "[file reply]",
                    });
                }
                catch (e) {
                    this.deps.log?.(`human reply continuation failed qitem=${route.correlationQitemId} ts=${ts}: ${e.message}`);
                    return { landed: false, qitemId, reason: "resolve_failed", correlationQitemId: route.correlationQitemId };
                }
            }
            this.deps.seen.mark(eventId, "landed"); // durable qitem exists → safe to mark
            this.deps.log?.(`qitem ${qitemId} -> ${route.destination} (ts=${ts})`);
            return { landed: true, qitemId, correlationQitemId: route.correlationQitemId, replyResolution };
        }
        finally {
            this.inflight.delete(eventId);
        }
    }
    /**
     * LIVE path: attempt to land; on a genuine create failure, dead-letter the
     * event (attempt-counted) BEFORE returning — NOT marked seen (item 8).
     */
    async route(ev, attempts = 0, isCurrent = () => true) {
        const r = await this.attemptLand(ev, isCurrent);
        if (!r.landed && (r.reason === "create_failed" || r.reason === "resolve_failed")) {
            this.deps.deadLetter.append(ev, attempts + 1);
            this.deps.log?.(`dead-lettered ts=${ev.ts} (attempt ${attempts + 1})`);
        }
        const disposition = r.landed ? "accepted" : r.reason === "unregistered" ? "refused" : (r.reason === "dup" || r.reason === "inflight" || r.reason === "inactive") ? "ignored" : "dead-lettered";
        return { landed: r.landed, qitemId: r.qitemId, disposition, reason: r.reason, correlationQitemId: r.correlationQitemId, replyResolution: r.replyResolution };
    }
    /**
     * #193 — a button click on a decision's structured questions. The clicked message is the
     * decision's root, so the same thread map a typed reply uses names the decision and its seat
     * (never the button's own ids, which only pick the question and option). Each click records
     * one answer; once the set is complete the answers are final, and the continuation lands one
     * reply row on the seat and resolves the decision, exactly like a typed reply. The reply row's
     * id is derived from the decision, so a redelivered click or a retry finds the same row. A
     * failed continuation is dead-lettered and retried like a typed reply that failed to land.
     */
    async routeAction(payload) {
        const r = await this.attemptAction(payload, true);
        if (r.status === "handler-failed")
            this.deps.actionDeadLetter?.append(payload, 1);
        return r;
    }
    /** The key a live click's one thread reply is recorded under: Slack can redeliver an envelope we already handled, and
     *  the person must not read a second reply, such as "already closed" after "All answered". The click's user and
     *  action_ts identify it; a click without an action_ts can't be told from its redelivery, so it replies as before. */
    clickReplyKey(payload) {
        const actionTs = payload.actions?.[0]?.action_ts;
        return actionTs ? `click-reply:${payload.user?.id ?? "-"}:${actionTs}` : undefined;
    }
    async attemptAction(payload, live) {
        const action = payload.actions?.[0];
        const picked = parseQuestionAction(action?.block_id, action?.action_id);
        if (!picked)
            return { status: "ignored", reason: "not-a-question-button" };
        const rootTs = clickedRootTs(payload);
        // A thread reply about this click: once per live click; the dead-letter retry (live false) only confirms success.
        // A posted reply is recorded in the durable seen store, so a redelivery or a restart doesn't repeat it; one being
        // posted is held in memory, so a redelivery arriving meanwhile is skipped. A reply that failed to post isn't
        // recorded, so a later redelivery can still tell the person.
        const acknowledge = async (text) => {
            if (!rootTs || !this.deps.acknowledgeAnswer)
                return; // nothing can post (no bot token): record no reply either
            const key = live ? this.clickReplyKey(payload) : undefined;
            if (key && (this.replyingTo.has(key) || this.deps.seen.load().has(key)))
                return;
            if (key)
                this.replyingTo.add(key);
            try {
                const posted = await this.deps.acknowledgeAnswer?.({ channel: payload.channel?.id, threadTs: rootTs, text });
                if (key && posted !== false)
                    this.deps.seen.mark(key, "click-reply");
            }
            catch (e) {
                this.deps.log?.(`click reply failed thread=${rootTs}: ${e.message}`);
            }
            finally {
                if (key)
                    this.replyingTo.delete(key);
            }
        };
        const who = this.deps.resolveSender(payload.user?.id ?? "");
        if (!who.admitted) {
            this.deps.log?.(`click REFUSED — unregistered sender ${payload.user?.id}: ${who.teaching}`);
            if (live)
                await acknowledge(CLICK_REPLIES.unregistered);
            return { status: "refused", reason: "unregistered" };
        }
        const route = rootTs ? this.deps.resolveRoute?.({ type: "message", thread_ts: rootTs, channel: payload.channel?.id }) : undefined;
        const qitemId = route?.correlationQitemId;
        if (!rootTs || !route || !qitemId) {
            if (live)
                await acknowledge(CLICK_REPLIES.unmapped);
            return { status: "ignored", reason: "unmapped-message" };
        }
        const recorded = this.deps.recordHumanAnswer?.({ qitemId, actorSession: who.source, ...picked });
        if (!recorded || recorded.status !== "recorded") {
            const reason = recorded?.reason ?? "answers-unavailable";
            // A closed decision holding this person's clicked answer: typically Slack's redelivery of the click that closed
            // it, after that click's own confirmation failed to post. It was recorded, so say that.
            if (live)
                await acknowledge(recorded?.answerOnRecord ? CLICK_REPLIES.onRecord : clickNotRecordedReply(reason));
            return { status: "ignored", reason };
        }
        const lines = formatHumanAnswers(recorded.questions, recorded.answers);
        if (!recorded.complete) {
            this.deps.log?.(`answer recorded qitem=${qitemId} question=${picked.questionId}`);
            const [just] = formatHumanAnswers(recorded.questions.filter((q) => q.id === picked.questionId), recorded.answers);
            const waiting = unansweredQuestions(recorded.questions, recorded.answers).map((q) => q.question);
            if (live)
                await acknowledge(escapeSlackText(redactSecrets(`Recorded: ${just}. Still to answer: ${waiting.join("; ")}`)));
            return { status: "accepted", reason: "answer-recorded" };
        }
        let resolution;
        try {
            await this.deps.queue.createQitem({
                qitemId: `qitem-slack-answers-${createHash("sha256").update(qitemId).digest("hex").slice(0, 20)}`,
                source: who.source,
                destination: route.destination,
                priority: "routine",
                tags: [...route.tags ?? ["founder-slack", "inbound"], "human-answer"],
                inReplyTo: qitemId,
                summary: `Founder via Slack: answered ${lines.length === 1 ? "1 question" : `${lines.length} questions`}`,
                body: `${lines.join("\n")}\n\n---\nAnswers (question id → option id): ${JSON.stringify(recorded.answers)}\nIn reply to: ${qitemId} (its humanAnswers field holds the same)\nRouted by openrig slack-inbound (button click).`,
            });
            resolution = await this.deps.resolveHumanReply?.({ qitemId, actorSession: who.source, decision: lines.join("; ") });
        }
        catch (e) {
            this.deps.log?.(`answer continuation failed qitem=${qitemId}: ${e.message}`);
            if (live)
                await acknowledge("Your answers are recorded, but handing them back failed. OpenRig will retry.");
            return { status: "handler-failed", reason: "answer-continuation-failed" };
        }
        if (resolution === "not-applicable") {
            // The reply row reached the seat, but the decision did not close: say so on the log and
            // the receipt instead of reporting success. Retrying cannot change this outcome.
            this.deps.log?.(`answers complete but resolve not applicable qitem=${qitemId}`);
            if (live)
                await acknowledge(CLICK_REPLIES.notClosed);
            return { status: "refused", reason: "resolve-not-applicable" };
        }
        this.deps.log?.(`answers complete qitem=${qitemId} -> ${route.destination}`);
        if (resolution === "resolved")
            await acknowledge(escapeSlackText(redactSecrets(`All answered, sent back: ${lines.join("; ")}`)));
        return { status: "accepted", reason: "answers-complete" };
    }
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
    async routeReaction(ev, attempts = 0) {
        const r = await this.attemptReaction(ev);
        if (r.status !== "handler-failed")
            return r;
        this.deps.deadLetter.append(ev, attempts + 1);
        this.deps.log?.(`dead-lettered reaction on ts=${ev.item?.ts} (attempt ${attempts + 1})`);
        return { status: "dead-lettered", reason: r.reason };
    }
    async attemptReaction(ev) {
        const eventId = `reaction:${ev.item?.channel ?? "-"}:${ev.item?.ts ?? "-"}:${ev.user ?? "-"}:${ev.reaction ?? "-"}:${ev.event_ts ?? "-"}`;
        if (this.deps.seen.load().has(eventId))
            return { status: "ignored", reason: "dup" };
        if (this.inflight.has(eventId))
            return { status: "ignored", reason: "inflight" };
        const who = this.deps.resolveSender(ev.user ?? "");
        if (!who.admitted) {
            this.deps.log?.(`reaction REFUSED — unregistered sender ${ev.user}: ${who.teaching}`);
            return { status: "refused", reason: "unregistered" };
        }
        let route;
        try {
            route = this.deps.resolveRoute?.({ type: "reaction_added", thread_ts: ev.item?.ts, channel: ev.item?.channel });
        }
        catch (e) {
            // The event is already acknowledged and Slack won't resend it: keep it for the retry pass.
            this.deps.log?.(`reaction route lookup failed for ts=${ev.item?.ts}: ${e.message}`);
            return { status: "handler-failed", reason: "route_failed" };
        }
        // A mapped thread names its ask; the unrouted fallback names none.
        const ask = route?.correlationQitemId ?? route?.tags?.find((tag) => tag.startsWith("reply-to:"))?.slice("reply-to:".length);
        if (!route || !ask) {
            this.deps.log?.(`reaction ignored: ts=${ev.item?.ts} is not an ask's message`);
            return { status: "ignored", reason: "not-an-ask" };
        }
        this.inflight.add(eventId);
        try {
            await this.deps.queue.createQitem({
                qitemId: `qitem-slack-reaction-${createHash("sha256").update(eventId).digest("hex").slice(0, 20)}`,
                source: who.source,
                destination: route.destination,
                priority: "routine",
                tags: [...route.tags ?? ["founder-slack", "inbound"], "human-reaction"],
                inReplyTo: ask,
                summary: `Founder via Slack: reacted :${ev.reaction}: to ${ask}`,
                body: [
                    `${who.source} reacted :${ev.reaction}: to your ask ${ask} in Slack.`,
                    "",
                    "A reaction doesn't answer or close the ask. Decide what it means: an answer, an acknowledgement, or neither.",
                    "",
                    "---",
                    `Source: slack channel=${ev.item?.channel} user=${ev.user} message_ts=${ev.item?.ts} event_ts=${ev.event_ts}`,
                    `In reply to: ${ask}`,
                    "Routed by openrig slack-inbound (reaction).",
                ].join("\n"),
            });
            this.deps.seen.mark(eventId, "landed");
        }
        catch (e) {
            this.deps.log?.(`reaction create failed for ${ask}: ${e.message}`);
            return { status: "handler-failed", reason: "create_failed" };
        }
        finally {
            this.inflight.delete(eventId);
        }
        this.deps.log?.(`reaction :${ev.reaction}: on ${ask} -> ${route.destination}`);
        return { status: "accepted", reason: "reaction" };
    }
    /**
     * INTERRUPTION-SAFE retry (item 8): read the durable set NON-destructively,
     * attempt each, then ATOMICALLY replace the file with only the still-failing
     * entries. The original file stays intact until the atomic replace, so a crash
     * at any point loses nothing (a since-landed event is skipped via the seen-set).
     * Does NOT go through route() (which would double-append) — uses attemptLand.
     */
    async retryDeadLetters() {
        // Connect-time and periodic retries can overlap. Join the owned pass rather
        // than replacing its snapshot or dropping its in-flight entries as duplicates.
        if (this.retryPass)
            return this.retryPass;
        const pass = this.retryDeadLetterPass();
        this.retryPass = pass;
        try {
            return await pass;
        }
        finally {
            if (this.retryPass === pass)
                this.retryPass = undefined;
        }
    }
    async retryDeadLetterPass() {
        const entries = this.deps.deadLetter.readAll();
        if (entries.length === 0)
            return this.retryActionDeadLetters();
        this.deps.log?.(`retrying ${entries.length} dead-letter(s)`);
        const stillFailing = [];
        let landed = 0;
        const seen = this.deps.seen.load();
        for (const e of entries) {
            if (e.ev.type === "reaction_added") {
                // #899 — a reaction has no message ts of its own; it retries through its own path.
                const r = await this.attemptReaction(e.ev);
                if (r.status === "accepted")
                    landed++;
                else if (r.status === "handler-failed")
                    stillFailing.push({ ev: e.ev, at: e.at, attempts: e.attempts + 1 });
                else if (r.reason === "inflight")
                    stillFailing.push(e);
                continue;
            }
            if (e.ev.ts && seen.has(this.inboundEventId(e.ev)))
                continue; // already landed → recovered, drop from set
            const r = await this.attemptLand(e.ev);
            if (r.landed)
                landed++;
            else if (r.reason === "create_failed" || r.reason === "resolve_failed")
                stillFailing.push({ ev: e.ev, at: e.at, attempts: e.attempts + 1 });
            else if (r.reason === "inflight")
                stillFailing.push(e); // owner has not proved durable landing yet
        }
        this.deps.deadLetter.replaceBatch(entries, stillFailing); // atomic; newer appends stay owed
        const actions = await this.retryActionDeadLetters();
        return { retried: entries.length + actions.retried, landed: landed + actions.landed };
    }
    /** #193 — retry dead-lettered clicks. Same interruption-safe shape as the event retry:
     *  read, attempt each, then atomically keep only the ones still failing. */
    async retryActionDeadLetters() {
        const store = this.deps.actionDeadLetter;
        const entries = store?.readAll() ?? [];
        if (!store || entries.length === 0)
            return { retried: 0, landed: 0 };
        const stillFailing = [];
        let landed = 0;
        for (const e of entries) {
            const r = await this.attemptAction(e.ev, false);
            if (r.status === "handler-failed")
                stillFailing.push({ ev: e.ev, at: e.at, attempts: e.attempts + 1 });
            else if (r.status === "accepted")
                landed++;
        }
        store.replaceBatch(entries, stillFailing);
        return { retried: entries.length, landed };
    }
}
/**
 * Handle one Socket Mode envelope. FAST-ACK first, ALWAYS (item 8: Socket Mode
 * punishes slow acks; transport redelivery is not the safety net). Then filter
 * and route. Ack happens even if routing later fails — the dead-letter, not
 * transport redelivery, is the zero-drop net.
 */
export async function handleEnvelope(env, ack, router, log, onReceived) {
    if (env.envelope_id)
        ack(); // fast-ack, unconditional, first
    onReceived?.(); // diagnostic receipt follows ACK but precedes every handler filter
    if (env.type === "disconnect")
        return { status: "ignored", reason: "disconnect" };
    if (env.type === "interactive") {
        // #193 — a button click. Other interactive payloads (shortcuts, modals) are not ours.
        if (env.payload?.type !== "block_actions")
            return { status: "ignored", reason: "interactive-type" };
        return router.routeAction(env.payload);
    }
    if (env.type !== "events_api")
        return { status: "ignored", reason: "envelope-type" };
    const ev = { ...env.payload?.event, recoveredAfterGap: undefined }; // only history admission supplies recovery provenance
    const decision = ingestDecision(ev);
    if (!decision.ingest) {
        // P28: name the branch that FIRED and the conversation it came from. Privacy rail — a channel
        // id and a branch LABEL only: never bodies, tokens, user ids, or text content/length.
        if (ev.type) {
            log?.(`ignored non-ingestible event type=${ev.type} subtype=${ev.subtype ?? "-"} files=${ev.files?.length ?? 0}` +
                ` channel=${ev.channel ?? "-"} reason=${decision.reason}`);
        }
        return { status: "ignored", reason: decision.reason };
    }
    if (ev.type === "reaction_added")
        return router.routeReaction(ev);
    const routed = await router.route(ev);
    return { status: routed.disposition, reason: routed.reason };
}
//# sourceMappingURL=inbound.js.map