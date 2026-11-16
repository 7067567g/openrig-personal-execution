import { Hono } from "hono";
import type { ProviderKind } from "../domain/provider/provider-types.js";
export interface ProviderRoutesOptions {
    /** Tests shorten the deadlines and pin the clock; production uses the named defaults. */
    usageAcrossHosts?: {
        readTimeoutMs?: number;
        viewDeadlineMs?: number;
        refreshDeadlineMs?: Partial<Record<ProviderKind, number>>;
        now?: () => string;
    };
}
export declare function providerRoutes(opts?: ProviderRoutesOptions): Hono;
//# sourceMappingURL=provider.d.ts.map