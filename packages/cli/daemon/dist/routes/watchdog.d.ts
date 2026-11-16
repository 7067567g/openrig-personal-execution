import { Hono } from "hono";
/**
 * Watchdog HTTP routes (PL-004 Phase C). Backs `rig watchdog` CLI verb.
 *
 * Per Phase A R1 SSE route-order lesson: SSE/static routes mounted
 * BEFORE the bare-param /:job_id catchall so the literal `/sse` and
 * literal action paths win over the param route.
 *
 * Endpoints:
 *   POST /register          register a new watchdog job
 *   GET  /list              list all watchdog jobs (active + stopped + terminal)
 *   GET  /sse               SSE stream of watchdog.* events
 *   GET  /:job_id           show one job
 *   GET  /:job_id/status    job + recent history (compact summary)
 *   POST /:job_id/stop      operator stop
 */
export declare function watchdogRoutes(): Hono;
//# sourceMappingURL=watchdog.d.ts.map