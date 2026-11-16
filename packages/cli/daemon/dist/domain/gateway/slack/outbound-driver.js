// S10 — the OUTBOUND driver: the gateway subsystem owns the outbound decision (the shape the
// M1 reconciliation named — queue poll + admission — now in-process). Each sweep selects the
// FRESH human alerts (slice-11 semantics preserved verbatim: qitemId-keyed durable seen-state,
// marked ONLY after delivered) and dispatches each through the subsystem wire, which persists
// the decision durably BEFORE delivery and retains it on failure (replay owns the retry).
//
// Duplicate-absence design (proof item: durability through failure):
//   - seen(qitemId): marked only after delivered-ok — the slice-11 at-least-once contract.
//   - inflight(qitemId), in-memory: a dispatched-but-unresolved qitem is not re-dispatched by
//     a later sweep — the durable buffer owns its retry (replay), never a second decision.
//   - at start(), inflight SEEDS from the durable buffer's pending decisions (payload carries
//     qitemId): after a daemon restart the replay path owns those qitems, so a sweep cannot
//     mint a second decisionId for the same alert — the restart double-dispatch window is
//     closed by construction. The only remaining duplicate is the locked contract's accepted
//     rare crash window (delivered but crashed before seen-mark/ack): byte-identical, never a drop.
import { DispatchBuffer } from "../dispatch-buffer.js";
export const OUTBOUND_OP = "post_message";
export class SlackOutboundDriver {
    deps;
    inflight = new Set();
    timer;
    sweeping = false;
    constructor(deps) {
        this.deps = deps;
    }
    /** Seed inflight from the durable buffer (restart no-double-dispatch), then start the poll. */
    start() {
        try {
            for (const d of new DispatchBuffer(this.deps.home).pending()) {
                const payload = d.payload;
                const key = payload?.notificationKey ?? payload?.qitemId;
                if (key)
                    this.inflight.add(key);
            }
        }
        catch { /* unreadable buffer: replay still dedups by decisionId at delivery */ }
        const interval = this.deps.intervalMs ?? 30000;
        this.timer = setInterval(() => void this.sweepOnce(), interval);
        if (typeof this.timer.unref === "function") {
            this.timer.unref();
        }
    }
    /** One sweep: fresh = active human alerts minus seen minus inflight. Dispatch each. */
    async sweepOnce() {
        if (this.sweeping)
            return { alerts: 0, fresh: 0, dispatched: [], refused: [] };
        this.sweeping = true;
        try {
            const alerts = await this.deps.queue.listHumanAlerts(this.deps.filter);
            const seen = this.deps.seen.load();
            const fresh = alerts.filter((q) => !seen.has(notificationKey(q)) && !this.inflight.has(notificationKey(q)));
            const dispatched = [];
            const refused = [];
            for (const alert of fresh) {
                const res = this.deps.dispatch(OUTBOUND_OP, alert.destinationSession ?? "(unknown)", toPayload(alert));
                if (res.ok) {
                    this.inflight.add(notificationKey(alert));
                    dispatched.push(alert.qitemId);
                }
                else {
                    // Refused (e.g. delivery layer unconfigured → op unadvertised): honest, retried next
                    // sweep — nothing durable was minted, so this is not a retained decision.
                    refused.push({ qitemId: alert.qitemId, error: res.error });
                    this.deps.log?.(`outbound dispatch refused for ${alert.qitemId}: ${res.error}`);
                }
            }
            const result = { alerts: alerts.length, fresh: fresh.length, dispatched, refused };
            this.deps.onSweep?.(result);
            return result;
        }
        finally {
            this.sweeping = false;
        }
    }
    /** The delivery layer marked a qitem seen (delivered) — release the in-memory guard. */
    release(qitemId) {
        this.inflight.delete(qitemId);
    }
    stop() {
        if (this.timer)
            clearInterval(this.timer);
        this.timer = undefined;
    }
}
function toPayload(q) {
    return {
        qitemId: q.qitemId,
        notificationKey: q.notificationKey,
        ownerNotificationKind: q.ownerNotificationKind,
        ownerNotificationLevel: q.ownerNotificationLevel,
        humanIntent: q.humanIntent,
        humanDetail: q.humanDetail,
        replyTo: q.replyTo,
        humanQuestions: q.humanQuestions,
        summary: q.summary,
        body: q.body,
        destinationSession: q.destinationSession,
        sourceSession: q.sourceSession,
        evidenceRef: q.evidenceRef,
        tier: q.tier,
        tags: q.tags,
        state: q.state,
    };
}
function notificationKey(q) {
    return q.notificationKey ?? q.qitemId;
}
//# sourceMappingURL=outbound-driver.js.map