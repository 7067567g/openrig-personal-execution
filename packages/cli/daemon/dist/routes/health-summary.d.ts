import { Hono } from "hono";
import type Database from "better-sqlite3";
import type { RigRepository } from "../domain/rig-repository.js";
export interface HealthSummaryRoutesDeps {
    db: Database.Database;
    rigRepo: RigRepository;
}
export declare function healthSummaryRoutes(): Hono;
//# sourceMappingURL=health-summary.d.ts.map