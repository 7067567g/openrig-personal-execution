import { Hono } from "hono";
/**
 * Coordination L1 — Stream HTTP routes (PL-004 Phase A).
 *
 * Host-scoped (no rigId in path). Append-only intake/audit root for the
 * coordination primitive. CLI `rig stream` calls these endpoints.
 */
export declare function streamRoutes(): Hono;
//# sourceMappingURL=stream.d.ts.map