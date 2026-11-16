import type { AgentActivity } from "../types.js";
import type { CodexAuthMetadata } from "./codex-auth-reader.js";
import type { ProviderSignal } from "./provider-types.js";
interface ReactiveSeat {
    seatSession: string;
    runtime: string;
}
interface ReactiveActivityReader {
    getLatestForNode(input: {
        sessionName: string;
        now: Date;
    }): AgentActivity | null;
}
export interface ReactiveTapDeps {
    seats: readonly ReactiveSeat[];
    auth: CodexAuthMetadata;
    activity: ReactiveActivityReader;
    now: string;
    freshnessMs: number;
}
export type ReactiveVerificationReason = "generation_unverifiable" | "generation_unresolvable" | "generation_resolver_error";
export interface ReactiveVerificationTrigger {
    kind: "verification_required";
    provider: "codex";
    seatSession: string;
    accountRef: string;
    activityReason: ReactiveVerificationReason;
    blockedBy: "provider_probe_unavailable";
}
export type ReactiveDiscard = {
    kind: "discarded";
    provider: "codex";
    seatSession: string;
    accountRef: string;
    reason: "generation_mismatch" | "malformed_generation_verdict";
};
export interface ReactiveTapResult {
    signals: ProviderSignal[];
    triggers: ReactiveVerificationTrigger[];
    discards: ReactiveDiscard[];
}
/**
 * Map the current structured activity for each honestly identified Codex seat into reactive
 * provider rows. Generic needs-input activity is deliberately insufficient: permission prompts
 * are blocked seats too, but are not provider interruptions. Only the exact typed vocabulary above
 * is accepted, with raw subtype taking precedence over raw event and normalized reason.
 */
export declare function collectReactiveEventSignals(deps: ReactiveTapDeps): ReactiveTapResult;
export {};
//# sourceMappingURL=reactive-tap.d.ts.map