/** True when `text`, trimmed, is fully bracket-wrapped (`[...]`) — the
 *  shipped scaffold-template placeholder marker, i.e. NOT authored content. */
export declare function isScaffoldPlaceholderText(text: string): boolean;
/** release-0.4.7 placeholder-suppression completeness — true when `body`
 *  carries at least one numbered item (`1.` OR `1)` form) whose text is NOT a
 *  scaffold placeholder: the ONE authored-numbered-item grammar. Consumers:
 *  review compose `hasAuthoredMiniReqs` + BOTH scope-audit mini-reqs arms —
 *  one predicate heals the IF-3 dot/paren grammar divergence and the audit
 *  arm's placeholder-blindness together (arch MB-AR-1 primary shape).
 *  Prose-only or bullet-only bodies are deliberately NOT authored — the
 *  numbered tier is where approval starts (reviewer-L1 ruling 2026-07-11,
 *  intent-stage gate). `null` → false. */
export declare function hasAuthoredNumberedItem(body: string | null): boolean;
/** release-0.4.7 placeholder-suppression completeness — true when EVERY
 *  non-blank line of `block` is a scaffold placeholder: the section-level
 *  "nothing authored here" test. Per-LINE deliberately, not a whole-string
 *  trim — a two-line `[a]\n[b]` body is placeholder-only per line but would
 *  fail the single-line regex (the multi-line honest case, arch MB-AR-2).
 *  `null`/empty/blank-only → false: absence is its own state; callers keep
 *  their existing null handling. */
export declare function isPlaceholderOnlyBlock(block: string | null): boolean;
/** PM dogfood #1 (qitem-20260720015700-630eef64) — true when `body` is a
 *  PRESENT section whose EVERY non-blank line is scaffold-placeholder
 *  content: either a bare placeholder line, or a structural list row
 *  (numbered `1.`/`1)`, checkbox `- [ ]`, or bullet `-`/`*`) whose text is a
 *  placeholder — i.e. exactly what the shipped templates scaffold, nothing
 *  authored. This is the SECTION-level pristine test behind per-section
 *  source selection: only a pristine PRD section may yield to an authored
 *  README section; authored/prose/mixed content is NOT pristine and stays
 *  canonical wherever it lives. `null`/blank-only → false (absence is its
 *  own state; a missing section never triggers fallback). */
export declare function isPristineScaffoldSection(body: string | null): boolean;
/** The generic acceptance triple emitted by older slice-progress templates.
 *  Keep recognizing these exact literals in existing PROGRESS.md files so
 *  legacy scaffold marks never become authored acceptance evidence. New
 *  templates emit an outcome log instead; existing files are not migrated. */
export declare const GENERIC_SCAFFOLD_ACCEPTANCE: readonly string[];
/** KI-5.3-2 second-face follow-up (row e69daaef; r1 A3 confirmed) — the ONE
 *  proof-contract SOURCE-SELECTION home. Three readers (proof-add, review
 *  compose DELIVERED pairing, both scope-audit twins) previously derived the
 *  fallback target independently and DIVERGED: proof-add derived from SPEC
 *  while compose/audit fell back to README with no SPEC path — evidence
 *  recorded against one contract, displayed against another. Selection order
 *  over SECTION BODIES (each reader keeps its own extractor):
 *    authored SPEC -> "spec" (the one current contract)
 *    absent/pristine SPEC -> authored PRD -> "prd" (legacy fallback)
 *                         -> authored README -> "readme" (older fallback)
 *                         -> null
 *  "Authored" = present and NOT isPristineScaffoldSection. Consumers parse
 *  items from the SELECTED source's body with their shipped parsers. */
export declare function selectProofContractBody(args: {
    prdBody: string | null;
    specBody: string | null;
    readmeBody: string | null;
}): {
    source: "prd" | "spec" | "readme" | null;
    body: string | null;
};
//# sourceMappingURL=scaffold-placeholder.d.ts.map