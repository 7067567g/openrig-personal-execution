// B1 — the crash-cart RESTORE CONDUCTOR route (daemon-side batch verb). Plan-locked
// (B1-CRASH-CART-CONDUCTOR-PLAN-2026-08-21, content-hash 84401cd4). ASYNC on-commit
// shape (the locked rollup-stream / onAttemptStarted design): the route starts the
// conductor in the BACKGROUND and answers immediately with a fleet-attempt handle —
// it NEVER blocks to fleet completion (a real fleet restore is seconds-per-seat and
// would exceed any request timeout). The client polls the status endpoint for the
// rollup + triage as rigs complete. A cancel endpoint sets stop-before-next-rig.
import { Hono } from "hono";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { RestoreConductor, createDefaultRestoreRig, listRigsInKernelFirstOrder, aggregateFleetRollup, deriveFleetVerdict, } from "../domain/crash-cart-conductor.js";
export const crashCartRoutes = new Hono();
const fleetAttempts = new Map();
// Exported ONLY for tests — reset the in-memory store between cases.
export function __resetFleetAttempts() {
    fleetAttempts.clear();
}
function getDeps(c) {
    return {
        rigRepo: c.get("rigRepo"),
        snapshotRepo: c.get("snapshotRepo"),
        restoreOrchestrator: c.get("restoreOrchestrator"),
        // H1 — the app's runtime adapters + fs, WITHOUT which the orchestrator fail-closes
        // a pod-aware resume to awaiting-decision (seats can't return in their panes).
        runtimeAdapters: c.get("runtimeAdapters"),
        // AMENDMENT 2 — the shipped machinery the adopt branch composes.
        sessionRegistry: c.get("sessionRegistry"),
        tmuxAdapter: c.get("tmuxAdapter"),
        claimService: c.get("claimService"),
    };
}
/** AMENDMENT 2 — build the adopt deps from the SHIPPED machinery, or undefined when a
 *  degraded daemon lacks any of it (the conductor then behaves exactly pre-amendment:
 *  a live-panes rig fail-closes through restore's own 409 — no clobber, no new path). */
function buildAdoptDeps(deps) {
    const { rigRepo, sessionRegistry, tmuxAdapter, claimService, restoreOrchestrator, runtimeAdapters } = deps;
    if (!sessionRegistry || !tmuxAdapter || !claimService)
        return undefined;
    return {
        // The same classification restore's 409 guard runs: DB-running sessions × tmux
        // reality. A tmux error is NOT live (fail-closed both ways: an unprobeable pane
        // never adopts here, and restore's own unknown-blocks guard still refuses).
        probeLiveSessions: async (rigId) => {
            const rig = rigRepo.getRig(rigId);
            if (!rig)
                return [];
            const logicalByNodeId = new Map(rig.nodes.map((n) => [n.id, n.logicalId]));
            const live = [];
            for (const session of sessionRegistry.getSessionsForRig(rigId)) {
                if (session.status !== "running")
                    continue;
                const logicalId = logicalByNodeId.get(session.nodeId);
                if (!logicalId)
                    continue;
                try {
                    if (await tmuxAdapter.hasSession(session.sessionName)) {
                        live.push({ sessionName: session.sessionName, logicalId });
                    }
                }
                catch { /* fail-closed: unprobeable ≠ live */ }
            }
            return live;
        },
        reconcileSession: (sessionName) => claimService.reconcileSession({ sessionName }),
        listRigSeats: (rigId) => rigRepo.getRig(rigId)?.nodes.map((n) => n.logicalId) ?? [],
        launchNodeSubset: (rigId, logicalIds) => restoreOrchestrator.launchNodeSubset(rigId, logicalIds, {
            adapters: runtimeAdapters ?? {},
            fsOps: { exists: (p) => existsSync(p) },
        }),
    };
}
function recompute(attempt) {
    attempt.rollup = aggregateFleetRollup(attempt.sequence);
}
// POST /api/crash-cart/restore-fleet — start the fleet restore, answer ON-COMMIT.
crashCartRoutes.post("/restore-fleet", (c) => {
    const deps = getDeps(c);
    const { rigRepo, snapshotRepo, restoreOrchestrator, runtimeAdapters } = deps;
    const fleetAttemptId = `fleet-${randomUUID()}`;
    const attempt = {
        sequence: [],
        rollup: aggregateFleetRollup([]),
        done: false,
        cancelled: false,
    };
    fleetAttempts.set(fleetAttemptId, attempt);
    const conductor = new RestoreConductor({
        listRigsInOrder: () => listRigsInKernelFirstOrder({ listRigs: () => rigRepo.listRigs() }),
        restoreRig: createDefaultRestoreRig({
            findLatestRestoreUsable: (rigId) => snapshotRepo.findLatestRestoreUsable(rigId),
            ...(typeof snapshotRepo.selectRestoreUsable === "function"
                ? { selectRestoreUsable: (rigId) => snapshotRepo.selectRestoreUsable(rigId) }
                : {}),
            // H1 — thread the app's adapters + fsOps into the shipped restore.
            restore: (snapshotId, opts) => restoreOrchestrator.restore(snapshotId, {
                ...opts,
                adapters: runtimeAdapters ?? {},
                fsOps: { exists: (p) => existsSync(p) },
            }),
        }, 
        // AMENDMENT 2 — LIVE panes adopt via the shipped machinery; DEAD panes unchanged.
        buildAdoptDeps(deps)),
        // H3 — the running attempt's cancel flag, polled stop-before-next-rig.
        isCancelled: () => attempt.cancelled,
    });
    // Run the fleet restore in the BACKGROUND — the response has already been sent.
    // Each rig updates the pollable rollup (the progress stream) as it completes.
    void conductor
        .restoreFleet({
        onRigDone: (r) => {
            attempt.sequence.push(r);
            recompute(attempt);
        },
    })
        .then(() => {
        attempt.done = true;
    })
        .catch(() => {
        // Best-effort: the fleet loop itself is guarded per rig; mark done so the
        // client stops polling. Per-rig failures are already in the rollup.
        attempt.done = true;
    });
    // Answer ON-COMMIT (immediately) — never block to fleet completion (r1 root).
    return c.json({ fleetAttemptId, status: "started" }, 202);
});
// GET /api/crash-cart/restore-fleet/:fleetAttemptId — poll progress + the rollup/triage.
crashCartRoutes.get("/restore-fleet/:fleetAttemptId", (c) => {
    const attempt = fleetAttempts.get(c.req.param("fleetAttemptId"));
    if (!attempt)
        return c.json({ error: "unknown fleet restore attempt" }, 404);
    // Verdict DERIVED at read from the current counts (R6 / ARCH-RULING Q2) — never a stored field.
    return c.json({
        done: attempt.done,
        cancelled: attempt.cancelled,
        rollup: attempt.rollup,
        verdict: deriveFleetVerdict(attempt.rollup.counts),
    });
});
// POST /api/crash-cart/restore-fleet/:fleetAttemptId/cancel — stop-before-next-rig.
crashCartRoutes.post("/restore-fleet/:fleetAttemptId/cancel", (c) => {
    const attempt = fleetAttempts.get(c.req.param("fleetAttemptId"));
    if (!attempt)
        return c.json({ error: "unknown fleet restore attempt" }, 404);
    attempt.cancelled = true;
    return c.json({ ok: true, cancelled: true });
});
//# sourceMappingURL=crash-cart.js.map