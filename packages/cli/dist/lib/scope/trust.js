// OPR.0.4.1.6 — read-time-trust derivation for `rig scope` (FR-5).
//
// The scope-and-versioning convention §2 keystone: an `established`/`canonical`
// artifact whose `verified` is stale, absent, bare, or a not-yet-verified
// placeholder is treated as `provisional`. Trust is DERIVED at read time from
// (stage x verified) and NEVER stored (a stored composite re-rots).
//
// This is the static-artifact sibling of the daemon's skill-audit. The 90-day
// freshness window + the bare/stale/verified taxonomy MIRROR
// `packages/daemon/src/domain/skill-audit.ts:34` (`FRESHNESS_WINDOW_DAYS = 90`)
// + its `checkStaleness` (:118-126). The daemon module is not importable from
// the CLI (separate package; the daemon is a spawned app, not a library), so we
// mirror the constant + taxonomy here rather than cross-import. The convention
// itself names no age window — 90 days is the load-bearing pin shared with
// skill-audit.
/** Mirror of skill-audit.ts:34 — keep in sync if that window changes. */
export const FRESHNESS_WINDOW_DAYS = 90;
const VERIFIED_RE = /^(\d{4}-\d{2}-\d{2})\s+against\s+(.+)$/i;
// Tool-written placeholder provenances. None is a real verification against a
// named source, so an established/canonical carrying one cannot coast as fresh
// (the exact "looks fresh while lying" trap §2 closes). `rig scope verified`
// replaces these with a real source.
const PLACEHOLDER_PROVENANCE_RE = /\bscaffold \(rig scope create\)|\bbackfill \(rig scope repair\)|\(unverified\)/i;
function isValidISODate(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
        return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime()))
        return false;
    // Reject overflowed components (e.g. 2026-13-99 → Date rolls over).
    return d.toISOString().slice(0, 10) === dateStr;
}
/** Classify a `verified:` frontmatter value. Mirrors skill-audit checkStaleness. */
export function deriveVerifiedTrust(verified, now = new Date()) {
    if (typeof verified !== "string" || verified.trim().length === 0) {
        return { status: "missing_verified" };
    }
    const m = VERIFIED_RE.exec(verified.trim());
    if (!m) {
        return { status: "bare_verified" };
    }
    const dateStr = m[1];
    const source = m[2].trim();
    if (!isValidISODate(dateStr)) {
        return { status: "bare_verified", date: dateStr };
    }
    if (PLACEHOLDER_PROVENANCE_RE.test(source)) {
        return { status: "unverified_provenance", date: dateStr, source };
    }
    const daysDiff = (now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > FRESHNESS_WINDOW_DAYS) {
        return { status: "stale_verified", date: dateStr, source };
    }
    return { status: "verified", date: dateStr, source };
}
/** Derive the effective (trust-adjusted) stage. Only `established`/`canonical`
 *  can be downgraded — they are the stages that claim "rely on me", so a weak
 *  `verified` knocks them back to `provisional`. wip/provisional/exits are
 *  echoed unchanged. */
export function deriveEffectiveStage(stage, verifiedStatus) {
    const declaredStage = typeof stage === "string" ? stage : "";
    const claimsReliable = declaredStage === "established" || declaredStage === "canonical";
    const trusted = verifiedStatus === "verified";
    if (claimsReliable && !trusted) {
        return {
            declaredStage,
            effectiveStage: "provisional",
            downgraded: true,
            reason: `${declaredStage} with ${verifiedStatus} verified -> treated as provisional (scope-and-versioning §2)`,
        };
    }
    return { declaredStage, effectiveStage: declaredStage, downgraded: false, reason: null };
}
/** Convenience: derive full read-time trust from a parsed frontmatter object. */
export function deriveScopeTrust(frontmatter, now = new Date()) {
    const verified = deriveVerifiedTrust(frontmatter.verified, now);
    const effective = deriveEffectiveStage(frontmatter.stage, verified.status);
    return { verified, ...effective };
}
//# sourceMappingURL=trust.js.map