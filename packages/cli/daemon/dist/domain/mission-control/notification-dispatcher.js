// PL-005 Phase B: Mission Control notification dispatcher.
//
// Subscribes to relevant events on the EventBus and POSTs through the
// configured notification adapter (ntfy default; webhook alternate).
// Best-effort delivery; failure does NOT interrupt the underlying
// action being notified about (PRD invariant). Emits `mission_control
// .notification_sent` / `_failed` for the audit trail.
//
// Triggers (Phase B v0):
//   - Mandatory: human-gate qitem arrival. Detected via the
//     `queue.created` event (Phase A coordination event) where the
//     created qitem's tier == "human-gate".
//   - Optional: verb completion. When opts.includeVerbCompletion is
//     true, `mission_control.action_executed` events also dispatch.
//
// Single notification target (the operator's phone). MVP context:
// no multi-user routing, no per-user opt-in matrix.
export class MissionControlNotificationDispatcher {
    db;
    eventBus;
    adapter;
    includeVerbCompletion;
    missionControlBaseUrl;
    now;
    unsubscribe = null;
    /** Per-(qitem_id, mechanism) drop set for once-per-qitem dedup. */
    dispatchedKeys = new Set();
    constructor(deps) {
        this.db = deps.db;
        this.eventBus = deps.eventBus;
        this.adapter = deps.adapter;
        this.includeVerbCompletion = Boolean(deps.includeVerbCompletion);
        this.missionControlBaseUrl = normalizeBaseUrl(deps.missionControlBaseUrl);
        this.now = deps.now ?? (() => new Date());
    }
    /** Subscribe to relevant EventBus events. Idempotent. */
    start() {
        if (this.unsubscribe)
            return;
        this.unsubscribe = this.eventBus.subscribe((event) => {
            void this.handleEvent(event);
        });
    }
    /** Unsubscribe + clear dedup set. Idempotent. */
    stop() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.dispatchedKeys.clear();
    }
    /**
     * Send a synthetic notification through the configured adapter so
     * the operator can verify their setup. Used by the
     * `POST /api/mission-control/notifications/test` route.
     */
    async sendTest() {
        const payload = {
            title: "Mission Control test notification",
            body: `Synthetic test from OpenRig daemon at ${this.now().toISOString()}`,
            tags: ["openrig", "mission-control", "test"],
        };
        const result = await this.adapter.send(payload);
        if (result.ok) {
            this.emitSent(null, "test");
        }
        else {
            this.emitFailed(null, result.error ?? "unknown");
        }
        return {
            mechanism: this.adapter.mechanism,
            target: this.adapter.target,
            ok: result.ok,
            ack: result.ack,
            error: result.error,
        };
    }
    async handleEvent(event) {
        if (event.type === "queue.created") {
            const qitem = this.lookupQitem(event.qitemId);
            if (!qitem || qitem.tier !== "human-gate")
                return;
            // Mandatory trigger: human-gate qitem arrival.
            await this.dispatch({
                triggerKind: "human-gate-arrival",
                qitemId: qitem.qitem_id,
                title: "human-gate qitem arrived",
                body: `New human-gate qitem ${qitem.qitem_id} from ${qitem.source_session} → ${qitem.destination_session}\n\n` +
                    truncateBody(qitem.body, 280),
                tags: ["openrig", "mission-control", "human-gate"],
            });
            return;
        }
        if (event.type === "mission_control.action_executed" && this.includeVerbCompletion) {
            await this.dispatch({
                triggerKind: "verb-completion",
                qitemId: event.qitemId,
                title: `verb completed: ${event.actionVerb}`,
                body: `Mission Control verb ${event.actionVerb} on qitem ${event.qitemId ?? "(none)"} by ${event.actorSession}`,
                tags: ["openrig", "mission-control", "verb-complete"],
            });
            return;
        }
    }
    async dispatch(input) {
        const dedupKey = `${input.qitemId ?? "no-qitem"}::${input.triggerKind}::${this.adapter.mechanism}`;
        if (this.dispatchedKeys.has(dedupKey))
            return;
        this.dispatchedKeys.add(dedupKey);
        const result = await this.adapter.send({
            title: input.title,
            body: input.body,
            qitemRef: this.qitemRef(input.qitemId),
            tags: input.tags,
        });
        if (result.ok) {
            this.emitSent(input.qitemId, result.ack ?? "ok");
        }
        else {
            this.emitFailed(input.qitemId, result.error ?? "unknown");
        }
    }
    emitSent(qitemId, _ack) {
        this.eventBus.emit({
            type: "mission_control.notification_sent",
            mechanism: this.adapter.mechanism,
            target: this.adapter.target,
            qitemId,
            sentAt: this.now().toISOString(),
        });
    }
    emitFailed(qitemId, error) {
        this.eventBus.emit({
            type: "mission_control.notification_failed",
            mechanism: this.adapter.mechanism,
            target: this.adapter.target,
            qitemId,
            error,
            failedAt: this.now().toISOString(),
        });
    }
    lookupQitem(qitemId) {
        const row = this.db
            .prepare(`SELECT qitem_id, source_session, destination_session, tier, body
           FROM queue_items WHERE qitem_id = ? LIMIT 1`)
            .get(qitemId);
        return row ?? null;
    }
    qitemRef(qitemId) {
        if (!qitemId)
            return undefined;
        if (!this.missionControlBaseUrl)
            return qitemId;
        const url = new URL("/mission-control", this.missionControlBaseUrl);
        url.searchParams.set("view", "human-gate");
        url.searchParams.set("qitem", qitemId);
        return url.toString();
    }
    /** Test/observability: clear once-per-qitem dedup set. */
    resetDedupForTest() {
        this.dispatchedKeys.clear();
    }
}
function truncateBody(s, max) {
    if (s.length <= max)
        return s;
    return s.slice(0, max - 1) + "…";
}
function normalizeBaseUrl(raw) {
    const trimmed = raw?.trim();
    if (!trimmed)
        return null;
    try {
        const url = new URL(trimmed);
        return url.toString();
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=notification-dispatcher.js.map