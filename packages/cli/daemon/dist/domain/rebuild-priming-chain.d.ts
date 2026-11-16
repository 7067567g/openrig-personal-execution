/**
 * OPR.0.5.5.5 (fix round B3) — THE production rebuild priming chain, extracted
 * from the seat route inline so the route and the tests consume ONE
 * implementation. Trust-precedence order is explicit and pinned:
 *
 *   1. current authored `RECAP.md` (highest trust);
 *   2. `LEARNED.md` (seat lineage lessons);
 *   3. the latest restore packet, when the compaction seam's seat-keyed
 *      restore-pending marker names one;
 *   4. superseded recap chain, newest first.
 *
 * The builder only DECLARES addresses; the handover service existence-filters
 * them (a declared-but-missing address is recorded as a named GAP, never
 * silently dropped). An unparseable seat ref is a NAMED empty chain, never a
 * guess.
 */
export declare function buildRebuildPrimingChain(seatRef: string, opts: {
    topologyRoot: string;
    openrigHome: string;
}): {
    artifacts: Array<{
        address: string;
        label: string;
    }>;
} | {
    emptyReason: string;
};
//# sourceMappingURL=rebuild-priming-chain.d.ts.map