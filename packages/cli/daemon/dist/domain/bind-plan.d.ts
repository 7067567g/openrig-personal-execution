export interface BindPlanInput {
    /** The DEDICATED bind-intent env (OPENRIG_BIND_HOST). Whitespace-only = absent. */
    bindHostEnv: string | undefined;
    /** The overloaded ROUTING env (OPENRIG_HOST/RIGGED_HOST) — observed for provenance
     *  honesty, never consulted for bind policy. */
    routingHostEnv: string | undefined;
    /** The active tailscale interface IP, when present. */
    tailscaleIp: string | null;
}
export interface BindPlan {
    mode: "explicit" | "default";
    hosts: string[];
    tailscaleDetected: boolean;
    /** Set when a routing env value was present and IGNORED for bind policy — the
     *  provenance line the daemon logs so the ignore is never silent. */
    ignoredRoutingHost?: string;
}
export declare function resolveBindPlan(input: BindPlanInput): BindPlan;
//# sourceMappingURL=bind-plan.d.ts.map