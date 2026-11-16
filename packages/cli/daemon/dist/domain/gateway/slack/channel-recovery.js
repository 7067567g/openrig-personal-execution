// Available channel history, including broadcast replies. A seen event is not scanned coverage.
import path from "node:path";
import { callWebApi } from "./slack-api.js";
import { ingestDecision } from "./inbound.js";
import { ChannelCoverageStore, slackMicros, slackTimestamp } from "./state-store.js";
/** One owner across socket generations. Stop fences admission and checkpoint writes;
 * already admitted I/O remains owned until it settles (no timeout/unlock race). */
export class ChannelRecovery {
    opts;
    store;
    now;
    coverage;
    pass;
    stopped = false;
    state = "not-started";
    reason;
    lastScanAt;
    accepted = 0;
    deadLettered = 0;
    constructor(opts) {
        this.opts = opts;
        this.now = opts.now ?? Date.now;
        this.store = opts.store ?? new ChannelCoverageStore(path.join(opts.stateDir, "slack-channel-coverage.json"));
    }
    initialize() {
        if (!this.opts.channel) {
            this.state = "unavailable";
            this.reason = "channel-not-configured";
            return;
        }
        try {
            this.coverage = this.store.initialize(this.opts.channel, slackTimestamp(BigInt(this.now()) * 1000n), path.join(this.opts.stateDir, "slack-inbound-seen.jsonl"), path.join(this.opts.stateDir, "slack-inbound-receipts.jsonl"));
            this.state = this.opts.token ? "pending" : "unavailable";
            this.reason = this.opts.token ? undefined : "bot-token-unresolved";
        }
        catch {
            this.state = "unavailable";
            this.reason = "checkpoint-unreadable-or-unwritable";
        }
    }
    status() {
        return { state: this.state, reason: this.reason, channel: this.opts.channel, lastScanAt: this.lastScanAt,
            coverage: this.coverage ? structuredClone(this.coverage) : null,
            acceptedThisProcess: this.accepted, deadLetteredThisProcess: this.deadLettered,
            limits: ["older history unknown", "counts reset on connector rewire/restart", "configured-channel history, including broadcast replies; non-broadcast thread recovery deferred",
                ...(this.coverage?.historyLimited ? ["Slack plan limit excludes older history; only available messages were scanned"] : []),
                "coverage means scanned available history; dead letters are custody, not delivery",
                "five-second settle margin; larger clock skew or history visibility lag remains unverified",
                "four pages / 100 entries / 15 seconds admission per pass; no global chronological ordering"] };
    }
    stop() { this.stopped = true; this.state = "stopped"; }
    run() {
        if (this.pass)
            return this.pass;
        if (this.stopped || !this.coverage || !this.opts.token || !this.opts.channel)
            return Promise.resolve();
        const pass = this.scan().catch(() => {
            if (!this.stopped) {
                this.state = "incomplete";
                this.reason = "storage-or-routing-failed";
            }
        });
        this.pass = pass;
        void pass.finally(() => { if (this.pass === pass)
            this.pass = undefined; });
        return pass;
    }
    save(next) {
        if (this.stopped)
            return;
        this.store.save(this.opts.channel, next);
        this.coverage = next; // publish only after the atomic write succeeds
    }
    async scan() {
        if (this.coverage.nextRetryAt && this.coverage.nextRetryAt > this.now()) {
            this.state = "backoff";
            return;
        }
        const deadline = this.now() + 15_000;
        this.lastScanAt = new Date(this.now()).toISOString();
        this.state = "scanning";
        this.reason = undefined;
        if (!this.coverage.pending) {
            // Leave recent posts for the next interval so ordinary visibility lag/clock skew
            // does not mark their timestamps covered before history can expose them.
            const upper = slackTimestamp(BigInt(Math.max(0, this.now() - 5000)) * 1000n);
            if (slackMicros(upper) <= slackMicros(this.coverage.coveredThrough)) {
                this.state = "pending";
                return;
            }
            this.save({ ...this.coverage, nextRetryAt: undefined, pending: { upper, nextLatest: upper } });
        }
        let entries = 0;
        for (let pages = 0; pages < 4 && !this.stopped && this.now() < deadline; pages++) {
            const c = { ...this.coverage };
            const lower = slackMicros(c.coveredThrough);
            const latest = slackMicros(c.pending.nextLatest);
            const r = await callWebApi("conversations.history", this.opts.token, {
                channel: this.opts.channel, oldest: slackTimestamp(lower > 0n ? lower - 1n : 0n),
                latest: c.pending.nextLatest, inclusive: false, limit: Math.min(25, 100 - entries),
            }, this.opts.fetchImpl, Math.min(5000, deadline - this.now()), "get-query");
            if (this.stopped)
                return;
            if (!r.ok) {
                const known = ["missing_scope", "not_in_channel", "channel_not_found", "invalid_auth", "token_revoked"];
                this.reason = r.status === 429 ? "rate-limited" : known.includes(r.error ?? "") ? r.error : "history-api-unavailable";
                const retrySeconds = r.retryAfterSeconds ?? (r.status === 0 || r.status >= 500 ? 5 : 300);
                this.save({ ...c, nextRetryAt: this.now() + retrySeconds * 1000 });
                this.state = "backoff";
                return;
            }
            const messages = r.json.messages;
            const cursor = r.json.response_metadata?.next_cursor;
            if (!Array.isArray(messages) || (r.json.has_more !== undefined && typeof r.json.has_more !== "boolean") ||
                (r.json.has_more === undefined && cursor === undefined) ||
                (cursor !== undefined && typeof cursor !== "string") || messages.length > 25 ||
                messages.some(m => !m || typeof m !== "object" || slackMicros(m.ts) === null ||
                    slackMicros(m.ts) < lower || slackMicros(m.ts) >= latest)) {
                this.state = "incomplete";
                this.reason = "invalid-history-page";
                return;
            }
            const ordered = [...messages].sort((a, b) => slackMicros(a.ts) < slackMicros(b.ts) ? -1 : 1);
            const more = r.json.has_more === true || (typeof cursor === "string" && cursor.length > 0);
            if (more && (!messages.length || slackMicros(ordered[0]?.ts) <= lower)) {
                this.state = "incomplete";
                this.reason = "history-page-no-progress";
                return;
            }
            // The page is valid; the flag describes unreachable older history. Retain that
            // qualification with the next durable page boundary rather than stalling forever.
            if (r.json.is_limited === true)
                c.historyLimited = true;
            for (const message of ordered) {
                if (this.stopped)
                    return;
                if (this.now() >= deadline || entries >= 100) {
                    this.state = "incomplete";
                    this.reason = "pass-budget";
                    return;
                }
                entries++;
                const ev = { ...message, channel: this.opts.channel, recoveredAfterGap: true };
                // Broadcast replies are channel history too; preserve their thread routing.
                if (ev.thread_ts && ev.thread_ts !== ev.ts && ev.subtype !== "thread_broadcast")
                    continue;
                if (!ingestDecision(ev).ingest)
                    continue;
                const landed = await this.opts.router.route(ev, 0, () => !this.stopped);
                if (this.stopped)
                    return;
                if (landed.reason === "inflight" || landed.reason === "inactive") {
                    this.state = "incomplete";
                    this.reason = "landing-in-progress";
                    return;
                }
                if (landed.disposition === "accepted")
                    this.accepted++;
                if (landed.disposition === "dead-lettered")
                    this.deadLettered++;
            }
            if (!more) {
                this.save({ ...c, coveredThrough: c.pending.upper, pending: undefined, nextRetryAt: undefined });
                this.state = "scanned";
                return;
            }
            this.save({ ...c, pending: { upper: c.pending.upper, nextLatest: ordered[0].ts }, nextRetryAt: undefined });
            if (entries >= 100)
                break;
        }
        if (!this.stopped) {
            this.state = "incomplete";
            this.reason = "pass-budget";
        }
    }
}
//# sourceMappingURL=channel-recovery.js.map