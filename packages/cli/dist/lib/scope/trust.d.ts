/** Mirror of skill-audit.ts:34 — keep in sync if that window changes. */
export declare const FRESHNESS_WINDOW_DAYS = 90;
export type VerifiedTrust = "verified" | "stale_verified" | "bare_verified" | "missing_verified" | "unverified_provenance";
export interface VerifiedTrustResult {
    status: VerifiedTrust;
    date?: string;
    source?: string;
}
/** Classify a `verified:` frontmatter value. Mirrors skill-audit checkStaleness. */
export declare function deriveVerifiedTrust(verified: unknown, now?: Date): VerifiedTrustResult;
export interface EffectiveStageResult {
    /** The stage as written in frontmatter (echoed, may be empty). */
    declaredStage: string;
    /** The stage to actually trust right now. */
    effectiveStage: string;
    /** True when the declared stage was downgraded by a weak `verified`. */
    downgraded: boolean;
    /** One-line why, or null when not downgraded. */
    reason: string | null;
}
/** Derive the effective (trust-adjusted) stage. Only `established`/`canonical`
 *  can be downgraded — they are the stages that claim "rely on me", so a weak
 *  `verified` knocks them back to `provisional`. wip/provisional/exits are
 *  echoed unchanged. */
export declare function deriveEffectiveStage(stage: unknown, verifiedStatus: VerifiedTrust): EffectiveStageResult;
/** Convenience: derive full read-time trust from a parsed frontmatter object. */
export declare function deriveScopeTrust(frontmatter: Record<string, unknown>, now?: Date): {
    verified: VerifiedTrustResult;
} & EffectiveStageResult;
//# sourceMappingURL=trust.d.ts.map