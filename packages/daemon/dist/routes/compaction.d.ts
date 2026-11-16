import { Hono } from "hono";
/**
 * OPR.0.4.3.14 — manual configurable compaction trigger route.
 *
 * POST /api/compaction/trigger { session } drives the SAME guided compaction
 * lifecycle the auto-policy runs, on demand, for one Claude seat. Mirrors the
 * /api/transport/send auth + resolveSessions ambiguity/404/409 pattern.
 *
 * The route resolves the target to a node + runtime and reads the EXISTING
 * context-usage projection BEFORE triggering — it never invents usage values.
 * The enforcer owns the reject reasons (non-Claude / no-usage) so there is one
 * source of truth for the guided-sequence contract.
 */
export declare function compactionRoutes(opts?: {
    bearerToken?: string | null;
}): Hono;
//# sourceMappingURL=compaction.d.ts.map