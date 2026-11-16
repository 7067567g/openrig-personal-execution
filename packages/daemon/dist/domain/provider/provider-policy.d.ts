import type { AccountAuthState, PrecheckResult, ProviderKind, ProviderSignal } from "./provider-types.js";
export type AutomationRefusal = "sourceClass_unknown" | "authority_unknown" | "not_allow_switch_decision" | "no_freshness_bound" | "unparsable_freshness_bound" | "stale";
export interface AutomationEligibility {
    eligible: boolean;
    refusals: AutomationRefusal[];
}
/**
 * BR-2 eligibility. Eligible ONLY when the signal is known (source + authority), explicitly
 * `allow_switch_decision`, and provably fresh. Fail-closed on freshness: a missing `staleAfter`
 * or an unparsable one is ineligible (NaN must never compare as fresh). Expiry is INCLUSIVE:
 * `now >= staleAfter` is stale. An unparsable `now` also cannot prove freshness → stale.
 */
export declare function signalEligibleForAutomation(signal: ProviderSignal, nowIso: string): AutomationEligibility;
/** Fields common to a manual and an automated precheck. */
interface PrecheckBase {
    /** The provider of the account being switched TO. */
    targetProvider: ProviderKind;
    /** Validate-at-use: the target's auth state, checked at precheck time (never assumed). */
    targetAuthState: AccountAuthState;
    /** Whether the seat currently has a live turn/conversation in flight. */
    seatHasLiveConversation: boolean;
}
/**
 * A manual precheck carries NEITHER a triggering signal nor a clock; an automated precheck
 * requires BOTH. The paired union makes "trigger without now" unrepresentable for typed
 * callers (the fail-closed hole is closed at the type level; a runtime guard below covers
 * untyped/JS callers).
 */
export type PrecheckInput = PrecheckBase & ({
    triggeringSignal?: undefined;
    now?: undefined;
} | {
    triggeringSignal: ProviderSignal;
    now: string;
});
export declare function precheckSwitch(input: PrecheckInput): PrecheckResult;
export {};
//# sourceMappingURL=provider-policy.d.ts.map