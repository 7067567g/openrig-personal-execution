export declare const HEALTH_DETECTORS: readonly ["process.ceremony-amplification", "process.review-carousel", "process.redundant-wake-storm", "governance.stale-directive", "governance.scope-admission-drift", "context.pressure"];
export interface HealthPolicy {
    schema: "openrig.health-policy/v0alpha1";
    disabledDetectors: string[];
    thresholds: {
        ceremonyTransitions: number;
        ceremonyRatio: number;
        reviewReturns: number;
        redundantWakes: number;
    };
    observationWindowSeconds: number;
    freshnessSeconds: number;
    diagnosis: {
        enabled: boolean;
        owner: string | null;
        detectors: string[];
        cooldownSeconds: number;
        maxRepresentations: number;
    };
    human: {
        address: string | null;
        conditions: Array<"critical" | "established pathology" | "confirmed ceremony">;
    };
}
export interface EffectiveHealthPolicy {
    version: string;
    policy: HealthPolicy;
    contextPressure: {
        warningPercent: number;
        criticalPercent: number;
    };
}
export declare const DEFAULT_HEALTH_POLICY: HealthPolicy;
export declare function healthHash(value: unknown): string;
export declare function object(value: unknown, keys: string[]): Record<string, unknown>;
export declare function validateHealthPolicy(value: unknown): HealthPolicy;
export declare class HealthPolicyStore {
    private readonly home;
    private readonly contextPressure;
    readonly path: string;
    constructor(home: string, contextPressure: () => EffectiveHealthPolicy["contextPressure"]);
    read(): EffectiveHealthPolicy;
    apply(value: unknown, actor: string): EffectiveHealthPolicy;
}
//# sourceMappingURL=health-policy.d.ts.map