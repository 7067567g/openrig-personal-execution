import type { InboundSenderResolution } from "./inbound.js";
import type { loadHumanRegistry as LoadFn, resolveSlackHandle as ResolveFn } from "../human-registry.js";
export interface RegistrySurface {
    loadHumanRegistry: typeof LoadFn;
    resolveSlackHandle: typeof ResolveFn;
}
export declare function makeInboundSenderResolver(reg: RegistrySurface, home?: string): (slackUserId: string) => InboundSenderResolution;
//# sourceMappingURL=inbound-admission.d.ts.map