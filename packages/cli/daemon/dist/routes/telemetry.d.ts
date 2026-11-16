import { Hono } from "hono";
import type { Database } from "better-sqlite3";
import { type TelemetrySource } from "../domain/finite-telemetry.js";
export interface TelemetryRouteDeps {
    db: () => Database;
    /** injectable clock so tests and VM seeds are deterministic */
    nowIso?: () => string;
    source?: TelemetrySource;
}
export declare function telemetryRoutes(deps: TelemetryRouteDeps): Hono;
//# sourceMappingURL=telemetry.d.ts.map