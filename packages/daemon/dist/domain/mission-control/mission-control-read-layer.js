// PL-005 Phase A: Mission Control read layer.
//
// Maps the 7 Mission Control views to data sources:
//   - my-queue            → queue_items where destination_session = operator
//                            AND tier='human-gate'
//   - human-gate          → queue_items where tier='human-gate'
//   - fleet               → daemon rig registry + queue, with optional CLI observations
//   - active-work         → queue_items where state in (pending, in-progress,
//                            blocked) sorted by priority
//   - recent-ships        → queue_items where state in (done, handed-off)
//                            ORDER BY ts_updated DESC LIMIT 10
//   - recently-active     → PL-004 Phase B ViewProjector built-in view
//   - recent-observations → stream_items table (Phase A daemon-backed source)
//                            with ~/.openrig/stream/<date>.jsonl as graceful
//                            degradation fallback
//
// Each row carries the 9-field phone-friendly content model (PRD § Acceptance
// Criteria item 1; non-negotiable across all 7 views regardless of UI density).
//
// Source-of-truth integration: PL-004 daemon-backed coordination services
// are the primary read path. Filesystem/CLI fallbacks are for graceful
// degradation only.
import { loadHumanRegistry } from "../gateway/human-registry.js";
export const MISSION_CONTROL_VIEWS = [
    "my-queue",
    "human-gate",
    "fleet",
    "active-work",
    "recent-ships",
    "recently-active",
    "recent-observations",
];
// Explicit operator selection remains supported. Without it, discover the single
// registered human at read time; missing/ambiguous identity never widens my-queue.
const RECENT_SHIPS_LIMIT = 10;
const ACTIVE_WORK_LIMIT = 50;
const RECENT_OBSERVATIONS_LIMIT = 50;
const PRIORITY_RANK = {
    critical: 0,
    high: 1,
    routine: 2,
    background: 3,
};
export class MissionControlReadLayer {
    queueRepo;
    viewProjector;
    streamStore;
    fleetCliCapability;
    defaultOperatorSession;
    constructor(deps) {
        this.queueRepo = deps.queueRepo;
        this.viewProjector = deps.viewProjector;
        this.streamStore = deps.streamStore;
        this.fleetCliCapability = deps.fleetCliCapability;
        this.defaultOperatorSession = deps.defaultOperatorSession ?? "";
    }
    /** V0.3.1 slice 05 — public getter for the resolved operator seat
     *  session. Route handlers (listDestinations, audit history) read
     *  this so the picker + audit filter always offer the configured
     *  operator seat even when the kernel rig isn't booted yet. */
    getDefaultOperatorSession() {
        if (this.defaultOperatorSession)
            return this.defaultOperatorSession;
        const registry = loadHumanRegistry();
        return registry.ok && registry.entities.length === 1 ? registry.entities[0].address : "";
    }
    async readView(viewName, opts) {
        switch (viewName) {
            case "my-queue":
                return this.readMyQueue(opts?.operatorSession ?? this.getDefaultOperatorSession());
            case "human-gate":
                return this.readHumanGate();
            case "fleet":
                return this.readFleet();
            case "active-work":
                return this.readActiveWork();
            case "recent-ships":
                return this.readRecentShips();
            case "recently-active":
                return this.readRecentlyActive();
            case "recent-observations":
                return this.readRecentObservations();
        }
    }
    readMyQueue(operatorSession) {
        if (!operatorSession)
            return {
                viewName: "my-queue", rows: [],
                meta: { rowCount: 0, degradedFields: ["operator identity unavailable or ambiguous: inspect rig gateway human list --json and select an address"] },
            };
        const items = this.queueRepo.list({
            destinationSession: operatorSession,
            state: ["pending", "in-progress", "blocked"],
            limit: ACTIVE_WORK_LIMIT,
        });
        const humanGateOnly = items.filter((q) => q.tier === "human-gate");
        return {
            viewName: "my-queue",
            rows: humanGateOnly.map((q) => qitemToRow(q, { defaultReadCost: "skim/approve" })),
            meta: { rowCount: humanGateOnly.length },
        };
    }
    readHumanGate() {
        const items = this.queueRepo.list({
            state: ["pending", "in-progress", "blocked"],
            limit: ACTIVE_WORK_LIMIT,
        });
        const humanGateOnly = items.filter((q) => q.tier === "human-gate");
        return {
            viewName: "human-gate",
            rows: humanGateOnly.map((q) => qitemToRow(q, { defaultReadCost: "skim/approve" })),
            meta: { rowCount: humanGateOnly.length },
        };
    }
    async readFleet() {
        const fleet = await this.fleetCliCapability.rollupFleet();
        const rows = fleet.rows.map((r) => fleetRowToCompactRow(r));
        return {
            viewName: "fleet",
            rows,
            meta: {
                rowCount: rows.length,
                rigsRunningStaleCli: fleet.staleCliCount,
                rigsWithUnknownCliCapabilities: fleet.unknownCliCount,
                degradedFields: fleet.degradedFields.length > 0 ? fleet.degradedFields : undefined,
                sourceFallback: fleet.sourceFallback ?? undefined,
            },
        };
    }
    readActiveWork() {
        const items = this.queueRepo.list({
            state: ["pending", "in-progress", "blocked"],
            limit: ACTIVE_WORK_LIMIT,
        });
        items.sort((a, b) => {
            const ar = PRIORITY_RANK[a.priority] ?? 99;
            const br = PRIORITY_RANK[b.priority] ?? 99;
            if (ar !== br)
                return ar - br;
            return a.tsUpdated.localeCompare(b.tsUpdated);
        });
        return {
            viewName: "active-work",
            rows: items.map((q) => qitemToRow(q, { defaultReadCost: "full" })),
            meta: { rowCount: items.length },
        };
    }
    readRecentShips() {
        const done = this.queueRepo.list({
            state: ["done", "handed-off"],
            limit: RECENT_SHIPS_LIMIT * 4,
        });
        done.sort((a, b) => b.tsUpdated.localeCompare(a.tsUpdated));
        const top = done.slice(0, RECENT_SHIPS_LIMIT);
        return {
            viewName: "recent-ships",
            rows: top.map((q) => qitemToRow(q, { defaultReadCost: "summary-only" })),
            meta: { rowCount: top.length },
        };
    }
    readRecentlyActive() {
        // Delegates to PL-004 Phase B's built-in `recently-active` view.
        const result = this.viewProjector.show("recently-active");
        const rows = result.rows.map((row) => builtinViewRowToCompactRow("recently-active", row));
        return {
            viewName: "recently-active",
            rows,
            meta: { rowCount: rows.length },
        };
    }
    readRecentObservations() {
        if (!this.streamStore) {
            return {
                viewName: "recent-observations",
                rows: [],
                meta: { rowCount: 0, sourceFallback: "stream-store-not-wired" },
            };
        }
        const items = this.streamStore.list({
            limit: RECENT_OBSERVATIONS_LIMIT,
            direction: "latest",
        });
        const rows = items.map((s) => streamItemToCompactRow(s));
        return {
            viewName: "recent-observations",
            rows,
            meta: { rowCount: rows.length },
        };
    }
}
function qitemToRow(q, opts) {
    const state = qitemStateToCompactState(q.state);
    const nextAction = q.state === "blocked" ? `unblock: ${q.blockedOn ?? "external-gate"}` : null;
    const pendingHumanDecision = q.tier === "human-gate" ? `${q.priority} human-gate item` : null;
    return {
        rigOrMissionName: q.destinationSession,
        currentPhase: q.tier ?? null,
        state,
        nextAction,
        pendingHumanDecision,
        readCost: opts.defaultReadCost,
        lastUpdate: q.tsUpdated,
        confidenceFreshness: q.priority,
        evidenceLink: null,
        qitemId: q.qitemId,
        rawSourceRef: q.sourceSession,
        qitemSummary: summarizeBody(q.body),
        qitemBody: q.body,
    };
}
function summarizeBody(body) {
    const compact = body.replace(/\s+/g, " ").trim();
    if (compact.length <= 120)
        return compact;
    return `${compact.slice(0, 117).trimEnd()}...`;
}
function qitemStateToCompactState(state) {
    switch (state) {
        case "in-progress":
            return "active";
        case "pending":
            return "idle";
        case "blocked":
            return "blocked";
        case "failed":
        case "denied":
        case "canceled":
            return "degraded";
        case "done":
        case "handed-off":
            return "idle";
    }
}
function fleetRowToCompactRow(r) {
    return {
        rigOrMissionName: r.rigName,
        currentPhase: r.lifecycleState ?? null,
        state: r.activityState,
        nextAction: r.attentionReason ?? null,
        pendingHumanDecision: null,
        readCost: "summary-only",
        lastUpdate: r.lastUpdate,
        confidenceFreshness: r.cliVersionLabel,
        evidenceLink: null,
        qitemId: null,
        rawSourceRef: r.rigName,
    };
}
function builtinViewRowToCompactRow(viewName, row) {
    const get = (k) => {
        const v = row[k];
        if (v === undefined || v === null)
            return null;
        return String(v);
    };
    return {
        rigOrMissionName: get("destination_session") ?? get("rig_name") ?? get("rigName") ?? viewName,
        currentPhase: get("tier") ?? get("state") ?? null,
        state: "idle",
        nextAction: null,
        pendingHumanDecision: null,
        readCost: "summary-only",
        lastUpdate: get("ts_updated") ?? get("ts_emitted") ?? new Date().toISOString(),
        confidenceFreshness: get("priority") ?? null,
        evidenceLink: null,
        qitemId: get("qitem_id"),
        rawSourceRef: get("source_session"),
    };
}
function streamItemToCompactRow(s) {
    return {
        rigOrMissionName: s.sourceSession,
        currentPhase: s.hintType ?? null,
        state: s.hintUrgency === "critical" ? "attention" : "idle",
        nextAction: s.hintDestination ?? null,
        pendingHumanDecision: null,
        readCost: "summary-only",
        lastUpdate: s.tsEmitted,
        confidenceFreshness: s.hintUrgency ?? null,
        evidenceLink: null,
        qitemId: null,
        rawSourceRef: s.streamItemId,
    };
}
//# sourceMappingURL=mission-control-read-layer.js.map