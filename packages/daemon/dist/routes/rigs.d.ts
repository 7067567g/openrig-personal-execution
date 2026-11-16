import { Hono } from "hono";
import type Database from "better-sqlite3";
import { type CurrentQitemSummary } from "../domain/graph-projection.js";
export declare const rigsRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export declare function loadCurrentQitemsForSessions(db: Database.Database, sessionNames: string[]): Map<string, CurrentQitemSummary[]>;
//# sourceMappingURL=rigs.d.ts.map