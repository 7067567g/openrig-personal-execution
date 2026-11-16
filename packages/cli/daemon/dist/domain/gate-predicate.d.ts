/** Tag namespace that marks gate work. */
export declare const GATE_TAG_PREFIX = "gate:";
/**
 * Known gate roles. Guidance / documentation only — the predicate accepts
 * ANY `gate:<role>` so new gate-holder roles need no code change.
 */
export declare const GATE_ROLES: readonly ["guard", "spec-review", "pm-lead", "review-r1", "review-r2", "qa", "human"];
export type GateRole = (typeof GATE_ROLES)[number];
/** The human-approval tier that maps to the `gate:human` role (fallback). */
export declare const HUMAN_GATE_TIER = "human-gate";
/** True if `tag` is a well-formed `gate:<role>` tag. */
export declare function isGateTag(tag: string): boolean;
/** Gate roles declared by a qitem's tags (order-preserving, de-duplicated). */
export declare function gateRolesOf(tags: readonly string[] | null | undefined): string[];
export interface GatePredicateInput {
    tags: readonly string[] | null | undefined;
    tier?: string | null;
}
/**
 * THE predicate: is this qitem gate work?
 * Primary: any `gate:<role>` tag. Secondary fallback: tier === "human-gate".
 */
export declare function qitemIsGated(input: GatePredicateInput): boolean;
/**
 * Effective gate roles for a qitem, including the human-gate tier fallback
 * surfaced as the `human` role. Empty iff the qitem is not gate work.
 */
export declare function effectiveGateRoles(input: GatePredicateInput): string[];
//# sourceMappingURL=gate-predicate.d.ts.map