import { Hono } from "hono";
import { SeatLifecycleService } from "../domain/seat-lifecycle-service.js";
export declare const seatRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export declare function seatLifecycleService(c: {
    get(key: never): unknown;
}): SeatLifecycleService;
//# sourceMappingURL=seat.d.ts.map