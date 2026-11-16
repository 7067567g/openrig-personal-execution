import { Hono } from "hono";
/**
 * Workflow runtime HTTP routes (PL-004 Phase D). Backs `rig workflow` CLI.
 *
 * Per Phase A R1 SSE route-order lesson: SSE/literal paths mounted
 * BEFORE bare-param /:instance_id catchall.
 *
 * Endpoints:
 *   POST /api/workflow/validate         validate a spec by file path
 *   POST /api/workflow/instantiate      create instance + entry qitem
 *   POST /api/workflow/project          close packet + project next (transactional-scribe)
 *   GET  /api/workflow/list             list instances by status
 *   GET  /api/workflow/sse              SSE stream of workflow.* events
 *   GET  /api/workflow/watch            alias of /sse
 *   GET  /api/workflow/:instance_id     show one instance
 *   GET  /api/workflow/:instance_id/trace  instance + trail
 *   POST /api/workflow/:instance_id/continue  inspect (idempotent)
 */
export declare function workflowRoutes(): Hono;
//# sourceMappingURL=workflow.d.ts.map