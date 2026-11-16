import { Hono } from "hono";
/**
 * Coordination L2 — Project (Classifier) HTTP routes (PL-004 Phase B).
 *
 * Backs `rig project` CLI verb. Lease lifecycle endpoints + project
 * (idempotent classify) + operator-verb reclaim + SSE.
 *
 * Per Phase A R1 SSE route-order lesson (slice IMPL § Audit Row 12):
 * SSE/static routes are mounted BEFORE the bare-param /:id catchall.
 */
export declare function projectsRoutes(): Hono;
//# sourceMappingURL=projects.d.ts.map