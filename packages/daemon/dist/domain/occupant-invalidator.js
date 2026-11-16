// GHOST-STAGE (e) — the CANONICAL OccupantInvalidator seam. The INTERFACE is the contract the cutover
// slice (SeatHandoverService.commit()) calls to invalidate a RETIRING occupant's seat-name-keyed
// state, so a successor — which under a cutover RESUMES INTO THE SAME PANE and REUSES the canonical
// seat name (retiringSessionName === successorSessionName) — never inherits it. dev-driver's cutover
// file imports THIS definition (one shape, no twin).
//
// Two invalidation classes (see the (e) enumeration/contract artifact):
//   Class-A (in-mem compaction maps 1a-1f + the name-keyed context sidecar 2a): hard-delete by name.
//     Safe by TIMING — invoked INSIDE commit() BEFORE the successor accumulates any name-keyed state,
//     so a name-scoped delete clears exactly the retiree's entries. (The name does NOT isolate the
//     retiree from the successor — they share it — the timing does.)
//   Class-B (durable queue_items / watchdog_jobs, seat-ROLE-bearing): a name-scoped drop would
//     NEUTRALIZE THE SUCCESSOR'S OWN legitimate role items, so it MUST gen-scope. That requires the
//     occupant-generation identity (atom-B). Until `retiringGeneration` is supplied, Class-B is a LOUD
//     no-op — NEVER a name-scoped drop.
export class DefaultOccupantInvalidator {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    invalidateRetiringOccupant(args) {
        const { retiringSessionName, retiringGeneration } = args;
        const log = this.deps.log ?? (() => { });
        // Class-A — hard-delete by name (safe by TIMING; runs at commit() before the successor writes).
        this.deps.enforcer.invalidateOccupant(retiringSessionName);
        this.deps.contextUsage.invalidateOccupantSidecar(retiringSessionName);
        // Class-B — gen-scoped ONLY. Never name-scope (a shared name can't discriminate retiree from
        // successor; a name-scoped drop would neutralize the successor's own live role items).
        if (retiringGeneration === undefined) {
            log(`[occupant-invalidator] Class-B (queue_items/watchdog_jobs) invalidation for "${retiringSessionName}" ` +
                `PENDING atom-B: no occupant-generation supplied, so NOT name-scoping (that would neutralize the ` +
                `successor's own legitimate role items). No-op until the generation identity lands.`);
            return;
        }
        // atom-B present → Class-B gen-scoped invalidation.
        // Watchdog (3b): stop every ARMED job registered by the retiring generation — a stale wake firing
        // into the successor's context is the specimen; the successor re-arms its own. Gen-scoped so the
        // successor's OWN armed jobs (same name, live gen) are untouched. A blocked row's current park timer
        // is kept: it wakes the seat that owns the row, and nothing re-arms it if it stops.
        const keepJobIds = this.deps.queue?.currentParkTimerIds?.() ?? [];
        const stopped = this.deps.watchdog?.dropArmedByRegisteringGeneration(retiringGeneration, keepJobIds) ?? 0;
        if (stopped > 0) {
            log(`[occupant-invalidator] Class-B: stopped ${stopped} armed watchdog job(s) registered by retired ` +
                `generation ${retiringGeneration} (seat "${retiringSessionName}") — successor re-arms its own.`);
        }
        // Queue_items (3a): RELEASE (never drop) every in-progress item CLAIMED by the retiring generation
        // back to pending — the role work is durable and the successor re-claims it; only the retiree's
        // stale claim is the ghost. Gen-scoped via the claimant generation (the successor's own claims,
        // under the reused name but its live gen, are untouched).
        const released = this.deps.queue?.releaseClaimsByGeneration(retiringGeneration) ?? 0;
        if (released > 0) {
            log(`[occupant-invalidator] Class-B: released ${released} in-progress queue item(s) claimed by retired ` +
                `generation ${retiringGeneration} (seat "${retiringSessionName}") back to pending — successor re-claims.`);
        }
    }
}
//# sourceMappingURL=occupant-invalidator.js.map