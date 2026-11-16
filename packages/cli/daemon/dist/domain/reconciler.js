// Only an active/non-terminal session can become detached. In particular,
// superseded rows are occupant history: rewriting one to detached resurrects
// it as a restore candidate and makes the next reboot ambiguous.
const SKIP_STATUSES = new Set(["detached", "exited", "superseded"]);
export class Reconciler {
    db;
    sessionRegistry;
    eventBus;
    tmuxAdapter;
    constructor(deps) {
        if (deps.db !== deps.sessionRegistry.db) {
            throw new Error("Reconciler: sessionRegistry must share the same db handle");
        }
        if (deps.db !== deps.eventBus.db) {
            throw new Error("Reconciler: eventBus must share the same db handle");
        }
        this.db = deps.db;
        this.sessionRegistry = deps.sessionRegistry;
        this.eventBus = deps.eventBus;
        this.tmuxAdapter = deps.tmuxAdapter;
    }
    async reconcile(rigId) {
        const sessions = this.sessionRegistry.getSessionsForRig(rigId);
        let checked = 0;
        let detached = 0;
        const errors = [];
        for (const session of sessions) {
            if (SKIP_STATUSES.has(session.status)) {
                continue;
            }
            let alive;
            try {
                // Boot-time reconciliation against a dead tmux server must still
                // detach stale rows: transport-absence is treated as detachable HERE,
                // by explicit choice at this call site (OPR.0.5.4.2 mini-req 2 — the
                // adapter no longer collapses that decision for its callers).
                const probe = await this.tmuxAdapter.probeSession(session.sessionName);
                alive = probe.state === "present";
                checked++;
            }
            catch (err) {
                errors.push({
                    sessionId: session.id,
                    error: err instanceof Error ? err.message : String(err),
                });
                continue;
            }
            if (!alive) {
                try {
                    const txn = this.db.transaction(() => {
                        this.sessionRegistry.markDetached(session.id);
                        return this.eventBus.persistWithinTransaction({
                            type: "session.detached",
                            rigId,
                            nodeId: session.nodeId,
                            sessionName: session.sessionName,
                        });
                    });
                    const persistedEvent = txn();
                    this.eventBus.notifySubscribers(persistedEvent);
                    detached++;
                }
                catch (err) {
                    errors.push({
                        sessionId: session.id,
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            }
        }
        return { checked, detached, errors };
    }
}
//# sourceMappingURL=reconciler.js.map