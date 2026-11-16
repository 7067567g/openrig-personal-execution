import { Hono } from "hono";
export interface RigModeRoutesOpts {
    /** Operator bearer token (same one Mission Control uses). When null,
     * the daemon's listen layer is loopback-only and write verbs pass
     * through; non-null requires `Authorization: Bearer <token>`. */
    bearerToken?: string | null;
}
export declare function rigModeRoutes(opts?: RigModeRoutesOpts): Hono;
//# sourceMappingURL=rig-mode.d.ts.map