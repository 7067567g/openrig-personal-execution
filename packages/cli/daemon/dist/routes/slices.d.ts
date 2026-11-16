import { Hono } from "hono";
import { SliceIndexer } from "../domain/slices/slice-indexer.js";
import { SliceDetailProjector } from "../domain/slices/slice-detail-projector.js";
export interface SlicesRoutesDeps {
    indexer: SliceIndexer;
    projector: SliceDetailProjector;
}
export declare function slicesRoutes(): Hono;
//# sourceMappingURL=slices.d.ts.map