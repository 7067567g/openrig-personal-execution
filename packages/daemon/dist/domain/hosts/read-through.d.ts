import type { Context, Next } from "hono";
export declare const READ_THROUGH_TIMEOUT_MS = 5000;
export declare const READ_THROUGH_ALLOWLIST: readonly ["/api/rigs/summary", "/api/rigs/:rigId/graph", "/api/rigs/:rigId/nodes", "/api/rigs/:rigId/nodes/:logicalId", "/api/ps", "/api/slices", "/api/slices/:name", "/api/slices/:name/doc/*", "/api/missions/:missionId", "/api/specs/library", "/api/specs/library/:id/review"];
export declare function isReadThroughPath(path: string): boolean;
/** The param-intercept middleware (arch E2 ruling). Mounted on /api/* ahead
 *  of the route table; consumes the `?host=` envelope for remote reads and
 *  passes everything else through untouched. */
export declare function hostReadThrough(): (c: Context, next: Next) => Promise<void | (Response & import("hono").TypedResponse<{
    error: string;
    boundary: string;
    hostId: string;
    method: string;
    path: string;
    message: string;
}, 405, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
    boundary: string;
    hostId: string;
    path: string;
    message: string;
}, 403, "json">) | (Response & import("hono").TypedResponse<{
    detail: string;
    remoteStatus?: number | undefined;
    error: string;
    hostId: string;
    failureClass: string;
}, 502, "json">) | (Response & import("hono").TypedResponse<string, never, "body">)>;
//# sourceMappingURL=read-through.d.ts.map