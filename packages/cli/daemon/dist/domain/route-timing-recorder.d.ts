import type { MiddlewareHandler } from "hono";
/**
 * OPR.0.4.3.21 — request-duration accounting for the EXPENSIVE topology
 * routes only (rigs summary/graph, per-rig nodes, ps). These are the densest
 * synchronous-CPU handlers (per-rig getNodeInventory fan-out, tmux
 * attachAgentActivity) and are the prime suspects when the event loop starves.
 *
 * Reuse-first (ponytail): one lightweight `app.use` middleware, in-memory
 * rolling last/max per route label, surfaced on the existing `/healthz`
 * payload. No new route, no new store, no persistence. Cheap routes are NOT
 * measured (label === null → the middleware is a no-op for them).
 */
export interface RouteTiming {
    /** Duration of the most recent request to this route (ms). */
    lastMs: number;
    /** Largest duration observed for this route (ms) since boot. */
    maxMs: number;
    /** Number of requests observed for this route since boot. */
    count: number;
}
/**
 * Classify a request into a stable expensive-route label, or null when the
 * route is not one we account for. Pure so the labeling is unit-provable.
 *
 * Grounded at 719a059e (IMPL-SPEC §1.4):
 *  - GET /api/rigs/summary        (rigs.ts:163 per-rig getNodeInventory)
 *  - GET /api/rigs/:id/graph      (rigs.ts:205 attachAgentActivity tmux fan-out)
 *  - GET /api/rigs/:id/nodes      (sessions.ts:82 per-node enrichment)
 *  - GET /api/ps                  (ps-projection.ts:151 N+1 inventory)
 */
export declare function expensiveRouteLabel(method: string, path: string): string | null;
export declare class RouteTimingRecorder {
    private readonly timings;
    record(label: string, durationMs: number): void;
    snapshot(): Record<string, RouteTiming>;
}
/**
 * The single timing middleware. Measures wall-clock around `next()` and
 * records ONLY when the request maps to an expensive route label.
 */
export declare function createRouteTimingMiddleware(recorder: RouteTimingRecorder): MiddlewareHandler;
//# sourceMappingURL=route-timing-recorder.d.ts.map