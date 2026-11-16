import { Hono } from "hono";
import { type HumanDeliveryReadiness } from "../domain/gateway/human-readiness.js";
export declare function gatewayRoutes(opts?: {
    home?: string;
    readiness?: (entityId: string, gatewayState: string) => Promise<HumanDeliveryReadiness | null>;
}): Hono;
//# sourceMappingURL=gateway.d.ts.map