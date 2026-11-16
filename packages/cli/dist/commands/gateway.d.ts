import { Command } from "commander";
export interface HumanRowRef {
    id: string;
    state: string;
    summary?: string;
}
export type HumanRowsLookup = (address: string) => Promise<{
    ok: true;
    rows: HumanRowRef[];
} | {
    ok: false;
    error: string;
}>;
export interface GatewayCommandDeps {
    queueRows?: HumanRowsLookup;
    humanReadiness?: HumanReadinessLookup;
}
export interface HumanReadinessView {
    state: "ready" | "not-ready" | "indeterminate";
    configured: boolean | null;
    enabled: boolean | null;
    active: boolean | null;
    ready: boolean;
    connector?: {
        kind: string;
        ref: string;
    };
    reason: string;
    nextAction: string | null;
    checkedAt?: string;
}
export type HumanReadinessLookup = (entityId: string) => Promise<HumanReadinessView>;
export declare function daemonHumanReadiness(entityId: string): Promise<HumanReadinessView>;
/** Default queue-row half of the remove guard: non-terminal rows addressed to the human,
 *  via the daemon. ok:false carries the reason the board COULD NOT BE CHECKED. */
export declare function daemonQueueRows(address: string): ReturnType<HumanRowsLookup>;
export declare function gatewayCommand(deps?: GatewayCommandDeps): Command;
//# sourceMappingURL=gateway.d.ts.map