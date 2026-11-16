// Crash-cart cockpit view MODEL (5.2 Wave B, plan c015d9ed §C3). The pre-daemon recovery view:
// bare `rig` with the daemon DOWN. View-local data model + builders (mirrors pulse-model.ts) — the
// renderer (render-crash-cart.ts) turns it into rows. Live data comes from the C2 daemon-down direct
// read (readCrashCartDiscovery); this builder adapts that discovery into the view model, keeping the
// renderer pure + testable.
//
// PM ruling (binding): the header stop-reason + prior-uptime are EXPLICIT honest-unknown — the slot
// says unavailable + WHY (no shutdown record is persisted), never blank, never inferred. Structure
// and ordering stay per the approved mock (3d3c90a0).
/** The honest-unknown text for the two unrecoverable header slots (PM ruling). */
export const NO_SHUTDOWN_RECORD = "unavailable — no shutdown record";
/** Extract HH:MM from an ISO-Z or SQLite `datetime('now')` timestamp (format-agnostic, no timezone
 *  math — the crash-cart shows wall times as recorded); null/unparseable ⇒ "unknown". */
export function hhmm(ts) {
    if (!ts)
        return "unknown";
    const m = /[T ](\d{2}:\d{2})/.exec(ts);
    return m ? m[1] : "unknown";
}
/** Adapt the C2 daemon-down discovery into the crash-cart view model. */
export function buildCrashCartModel(discovery) {
    // Crash language requires evidence of PRIOR LIFE: no rigs AND no last-activity ⇒ a fresh host, not
    // a crash — render onboarding framing (PM ruling), never a crash story.
    const mode = discovery.foundOnHost.length === 0 && !discovery.header.lastActivityAt ? "first-run" : "recovery";
    return {
        mode,
        header: {
            lastSeen: hhmm(discovery.header.lastActivityAt),
            uptimeText: NO_SHUTDOWN_RECORD,
            reasonText: NO_SHUTDOWN_RECORD,
        },
        foundOnHost: discovery.foundOnHost.map((r) => ({
            name: r.rigName,
            seatCount: r.seatCount,
            lastActive: hhmm(r.lastActiveAt),
            resumableCount: r.resumableCount,
        })),
        whereWorkStopped: discovery.whereWorkStopped.map((w) => ({
            session: w.destinationSession,
            summary: w.summary ?? "(no summary)",
            time: hhmm(w.tsUpdated),
        })),
    };
}
/** Static fixture reproducing the approved mock's data (with the PM honest-unknown header). Used by
 *  the demo screen + the strip-invariant test. */
export function demoCrashCartModel() {
    return {
        mode: "recovery",
        header: { lastSeen: "08:12", uptimeText: NO_SHUTDOWN_RECORD, reasonText: NO_SHUTDOWN_RECORD },
        foundOnHost: [
            { name: "openrig-pm", seatCount: 13, lastActive: "08:11", resumableCount: 7 },
            { name: "kernel", seatCount: 4, lastActive: "08:12", resumableCount: 4 },
            { name: "oversight", seatCount: 3, lastActive: "07:58", resumableCount: 3 },
        ],
        whereWorkStopped: [{ session: "pm-openrig", summary: "cut packet assembly", time: "08:09" }],
    };
}
//# sourceMappingURL=crash-cart-model.js.map