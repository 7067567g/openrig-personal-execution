import { Hono } from "hono";
/**
 * Coordination L5 — View HTTP routes (PL-004 Phase B).
 *
 * Backs `rig view` CLI verb. Lists registered views (built-in + custom),
 * runs view queries, and exposes view.changed SSE for downstream consumers
 * (PL-005 Operator Status / PL-006 Mission Control / PL-008 progress).
 *
 * Per Phase A R1 SSE route-order lesson (slice IMPL § Audit Row 12):
 * SSE/static routes are mounted BEFORE the bare-param /:name catchall.
 */
export declare function viewsRoutes(): Hono;
//# sourceMappingURL=views.d.ts.map