import type { Policy, PolicyJob } from "./types.js";
export interface ContextUsageConditionSource {
    measure(job: PolicyJob): number;
}
export declare function makeContextUsageThresholdPolicy(source?: ContextUsageConditionSource): Policy;
export declare const contextUsageThresholdPolicy: Policy;
//# sourceMappingURL=context-usage-threshold.d.ts.map