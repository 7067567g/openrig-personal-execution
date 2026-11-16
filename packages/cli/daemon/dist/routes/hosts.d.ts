import { Hono } from "hono";
import { type LoadResult } from "../domain/gateway/human-registry.js";
export declare function hostsRoutes(opts?: {
    bearerToken?: string | null;
    humanRegistry?: () => LoadResult;
}): Hono;
//# sourceMappingURL=hosts.d.ts.map