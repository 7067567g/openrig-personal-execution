import { performance } from "node:perf_hooks";
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
export function expensiveRouteLabel(method, path) {
    if (method !== "GET")
        return null;
    if (path === "/api/ps")
        return "GET /api/ps";
    if (path === "/api/rigs")
        return "GET /api/rigs";
    if (path === "/api/rigs/summary")
        return "GET /api/rigs/summary";
    // /api/rigs/:id/graph and /api/rigs/:id/nodes — a single dynamic segment
    // between /api/rigs/ and the trailing verb.
    const rigsMatch = /^\/api\/rigs\/[^/]+\/(graph|nodes)$/.exec(path);
    if (rigsMatch)
        return `GET /api/rigs/:id/${rigsMatch[1]}`;
    return null;
}
export class RouteTimingRecorder {
    timings = new Map();
    record(label, durationMs) {
        const existing = this.timings.get(label);
        if (!existing) {
            this.timings.set(label, { lastMs: durationMs, maxMs: durationMs, count: 1 });
            return;
        }
        existing.lastMs = durationMs;
        existing.maxMs = Math.max(existing.maxMs, durationMs);
        existing.count += 1;
    }
    snapshot() {
        return Object.fromEntries([...this.timings.entries()].map(([label, t]) => [label, { ...t }]));
    }
}
/**
 * The single timing middleware. Measures wall-clock around `next()` and
 * records ONLY when the request maps to an expensive route label.
 */
export function createRouteTimingMiddleware(recorder) {
    return async (c, next) => {
        const label = expensiveRouteLabel(c.req.method, c.req.path);
        if (!label) {
            await next();
            return;
        }
        const startedAt = performance.now();
        try {
            await next();
        }
        finally {
            recorder.record(label, performance.now() - startedAt);
        }
    };
}
//# sourceMappingURL=route-timing-recorder.js.map