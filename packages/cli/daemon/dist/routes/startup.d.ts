import { Hono } from "hono";
import type Database from "better-sqlite3";
import type { Node } from "../domain/types.js";
export declare const startupRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
/** A consent version derived from consumed state, never a second owner ledger. */
export declare function startupRevision(db: Database.Database, node: Node): string;
//# sourceMappingURL=startup.d.ts.map