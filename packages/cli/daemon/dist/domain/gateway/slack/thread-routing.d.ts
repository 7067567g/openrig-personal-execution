import type { SlackEvent } from "./inbound.js";
import type { ThreadSeatMap } from "./thread-seat-map.js";
export interface InboundRoute {
    destination: string;
    tags: string[];
    /** Exact human-gate qitem this thread was opened for. Absent on unmapped traffic. */
    correlationQitemId?: string;
    /** The routing class that fired — receipts per class ride the row tags + logs. */
    routeClass: "existing-thread" | "closed-thread" | "unmapped-thread" | "human-initiated";
}
export declare function makeThreadRouteResolver(opts: {
    map: ThreadSeatMap;
    /** The orchestrator slot for unrouted signals (first-class config: inboundDestination). */
    unroutedDestination: string;
    log?: (msg: string) => void;
}): (ev: SlackEvent & {
    thread_ts?: string;
}) => InboundRoute;
//# sourceMappingURL=thread-routing.d.ts.map