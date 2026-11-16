import { Hono } from "hono";
/**
 * Mission Control HTTP routes (PL-005 Phase A). Backs the integrated
 * Mission Control product UI inside the existing shell.
 *
 * Per Phase A R1 (PL-004) SSE route-order lesson: SSE/literal paths
 * mounted BEFORE bare-param /:view-name catchall.
 *
 * Endpoints:
 *   GET  /api/mission-control/views/:view-name   read one of 7 views
 *   POST /api/mission-control/action              execute one of 7 verbs
 *   GET  /api/mission-control/sse                 SSE stream of mission_control.* events
 *   GET  /api/mission-control/watch               alias of /sse
 *   GET  /api/mission-control/cli-capabilities    per-rig CLI capability cache
 *   GET  /api/mission-control/destinations         handoff/route destination candidates
 *   GET  /api/mission-control/views               list view names
 */
export interface MissionControlRoutesOpts {
    /**
     * PL-005 Phase B: bearer token enforced on write verbs (POST /action,
     * POST /notifications/test) when set. When null, the daemon is
     * loopback-bound and no auth is enforced (the index.ts startup
     * check guarantees this).
     */
    bearerToken?: string | null;
}
export interface MissionControlDestination {
    sessionName: string;
    label: string;
    source: "topology" | "queue";
    rigName?: string | null;
    logicalId?: string | null;
    runtime?: string | null;
    status?: string | null;
}
export declare function missionControlRoutes(opts?: MissionControlRoutesOpts): Hono;
//# sourceMappingURL=mission-control.d.ts.map