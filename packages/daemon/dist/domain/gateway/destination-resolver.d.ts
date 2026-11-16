import { type HumanFragment } from "./human-registry.js";
export type DestinationClass = {
    class: "pane-bound";
} | {
    class: "gateway-routable";
    resolvedHuman: string | null;
    via: "external-address" | "registry-alias";
} | {
    class: "unroutable";
    teaching: string;
};
export interface ClassifyDeps {
    /** Registered human entities (null/empty when the registry is absent/unreadable —
     *  classification degrades to external-address + topology checks only). */
    entities: readonly HumanFragment[] | null;
    /** Does this daemon have an explicit terminal transport for the destination? */
    hasTerminalTransport: (destination: string) => boolean;
}
export declare function classifyDestination(destination: string, deps: ClassifyDeps): DestinationClass;
//# sourceMappingURL=destination-resolver.d.ts.map