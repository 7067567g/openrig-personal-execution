/**
 * OPR.0.4.6.WF3 FR-5 — what/why/fix rendering for the named daemon
 * rejections (the house 3-part shape; clig.dev's rewrite-for-humans
 * rule). HUMAN MODE ONLY: `--json` preserves the RAW daemon body
 * byte-identically so scripts keep the stable error codes; exit codes
 * are untouched (1=4xx / 2=5xx, plus FR-1's outcome codes).
 *
 * Unrecognized error bodies fall back to the raw JSON render — this
 * module only rewrites what it genuinely understands.
 */
export interface ThreePartRejection {
    fact: string;
    consequence: string;
    action: string;
}
/**
 * Map a recognized daemon rejection to the 3-part shape, or null when
 * the body is not a named rejection (caller falls back to raw JSON).
 */
export declare function describeDaemonRejection(body: unknown, instanceHint?: string): ThreePartRejection | null;
/** Render the 3-part shape as stderr lines (the emit3PartError shape). */
export declare function formatThreePart(rej: ThreePartRejection): string[];
//# sourceMappingURL=workflow-errors.d.ts.map