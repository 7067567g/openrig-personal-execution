import { Hono } from "hono";
import type { SteeringComposer } from "../domain/steering/steering-composer.js";
export interface SteeringRoutesDeps {
    composer: SteeringComposer;
}
export declare function steeringRoutes(): Hono;
//# sourceMappingURL=steering.d.ts.map