import { Hono } from "hono";
import type { ProgressIndexer } from "../domain/progress/progress-indexer.js";
export interface ProgressRoutesDeps {
    indexer: ProgressIndexer;
}
export declare function progressRoutes(): Hono;
//# sourceMappingURL=progress.d.ts.map