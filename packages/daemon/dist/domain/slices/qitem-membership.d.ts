export interface QitemScopeTags {
    slices: Set<string>;
    missions: Set<string>;
}
/** Canonical scope membership from a qitem's raw tags column.
 *  Typed tags AUTHORITATIVE: JSON array parsed per element; each element
 *  comma-split (the legacy CLI form, per the matchQitems contract comment)
 *  and trimmed; exact `slice:`/`mission:` prefix match per token. No
 *  substring semantics live here — the legacy substring tier remains a
 *  matchQitems-local concern behind its zero-typed-rows condition.
 *
 *  TWO-TIER DOCTRINE: the SIGNAL tier (phase / band / attention) answers
 *  from canonical membership ONLY — this function. The DISPLAY tier (the
 *  queue-tab's qitemIds) may carry the gated legacy substring fallback.
 *  Never promote a display-tier match into a signal. */
export declare function parseScopeTags(rawTags: string | null | undefined): QitemScopeTags;
//# sourceMappingURL=qitem-membership.d.ts.map