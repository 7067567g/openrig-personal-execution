import type { HumanFragment } from "./human-registry.js";
import type { SlackConnectorConfig } from "./slack/config.js";
import { type ScopeVerdict } from "./slack/slack-api.js";
export type HumanDeliveryReadinessState = "ready" | "not-ready" | "indeterminate";
export interface HumanDeliveryReadiness {
    state: HumanDeliveryReadinessState;
    configured: boolean;
    enabled: boolean;
    active: boolean;
    ready: boolean;
    connector: {
        kind: string;
        ref: string;
    };
    reason: string;
    nextAction: string | null;
    checkedAt: string;
}
export interface HumanDeliveryReadinessInput {
    human: HumanFragment;
    config: SlackConnectorConfig;
    gatewayState: string;
    botToken: string | null;
}
export interface HumanDeliveryReadinessDeps {
    verifyScopes?: (token: string, required: string[]) => Promise<ScopeVerdict>;
    verifyMembership?: (token: string, channel: string) => Promise<{
        ok: boolean;
        isMember: boolean;
        error?: string;
    }>;
    now?: () => Date;
}
/** Resolve the registered human's PRIMARY binding to delivery truth in one record.
 * Connector details stay behind this transport-neutral shape; secrets never leave it. */
export declare function resolveHumanDeliveryReadiness(input: HumanDeliveryReadinessInput, deps?: HumanDeliveryReadinessDeps): Promise<HumanDeliveryReadiness>;
//# sourceMappingURL=human-readiness.d.ts.map