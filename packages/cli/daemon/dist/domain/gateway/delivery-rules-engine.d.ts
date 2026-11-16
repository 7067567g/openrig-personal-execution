import type { OwnerNotificationLevel } from "../queue-transition-log.js";
export declare const DELIVERY_OUTCOMES: readonly ["interrupt", "notify", "digest", "log"];
export type DeliveryOutcome = (typeof DELIVERY_OUTCOMES)[number];
export declare const AVAILABILITY_MODES: readonly ["available", "focus", "away", "off"];
export type AvailabilityMode = (typeof AVAILABILITY_MODES)[number];
export declare const AWAY_ESCALATION_DEFER_MINUTES = 30;
export declare const DIGEST_WINDOWS: {
    readonly C: "4h";
    readonly D: "daily";
};
/** The single-human termination record (A1.1): an escalation on an away/off
 *  human terminates at the recorded floor — who, availability,
 *  no-fallback-available, and the ruled delivery outcome. The multi-human
 *  fallback edge is 0.5.7; this seam takes it without vocabulary change. */
export interface DeliveryTermination {
    who: string;
    availability: AvailabilityMode;
    noFallbackAvailable: true;
    deliveryOutcome: DeliveryOutcome;
}
export interface DeliveryDecision {
    outcome: DeliveryOutcome;
    /** Mention iff interrupt — quiet cells never mention, by construction. */
    mention: boolean;
    digestWindow?: "4h" | "daily";
    /** Present only for the deferred away-escalation interrupt (fires once at T+N). */
    deferMinutes?: number;
    termination?: DeliveryTermination;
}
export interface DeliveryDecisionInput {
    level: OwnerNotificationLevel | null;
    escalation: boolean;
    human: {
        entityId: string;
        deliveryClass: "A" | "B" | "C" | "D";
        availability: AvailabilityMode;
    };
    dials: {
        minimumLevelThatPosts: OwnerNotificationLevel;
        minimumLevelThatInterrupts: OwnerNotificationLevel;
    };
}
/** Whole-field-absent legacy inference (the D1 convention): `away: true` reads
 *  as availability=away ONLY when the availability field is absent. A present
 *  availability is the authority; conflicts are refused at fragment validation,
 *  never silently resolved here. */
export declare function resolveAvailability(prefs: {
    availability?: string;
    away?: boolean;
}): AvailabilityMode;
/** Escalation-class derivation — ONE predicate (the ladder's aggregate tag or
 *  an explicit escalation tag), never a prose read. */
export declare function isEscalationClass(tags: readonly string[] | null | undefined): boolean;
export declare function decideDelivery(input: DeliveryDecisionInput): DeliveryDecision;
/** The termination transition literal — engine-owned, one definition site.
 *  (A row-side record; readers match the prefix, same discipline as the
 *  ladder's marker vocabulary.) */
export declare const DELIVERY_TERMINATION_PREFIX = "delivery-termination:";
export declare function formatDeliveryTermination(t: DeliveryTermination, notificationKey: string): string;
//# sourceMappingURL=delivery-rules-engine.d.ts.map