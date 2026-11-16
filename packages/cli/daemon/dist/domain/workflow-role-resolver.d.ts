/** The synchronous facts a candidate seat is judged by — materialized
 *  by the caller (workflow-role-context.ts) from the shipped
 *  rig-scoped inventory projection + sync work-enrichment. */
export interface RoleSeatCandidateFacts {
    logicalId: string;
    /** nodes.role (the commit-1 dimension). null = role-less. */
    role: string | null;
    nodeKind: "agent" | "infrastructure";
    lifecycleState: string;
    runtime: string | null;
    /** Pending-only backlog (state='pending' items; claimed/in-progress
     *  rank zero) — "least-loaded" = "least unclaimed backlog". */
    pendingWorkCount: number;
    /** The derived canonical coordinate `{pod}-{member}@{rig}`; null
     *  when underivable (no pod-aware logical id). */
    coordinate: string | null;
    /** The occupant-era session name (latest session row). Managed seats:
     *  equals `coordinate`. Adopted seats: the raw tmux name. */
    rawSessionName: string | null;
}
/** One evaluated-and-disqualified candidate — the loud-with-candidates
 *  evidence unit (BR-5). */
export interface RoleCandidateVerdict {
    coordinate: string | null;
    logicalId: string;
    disqualifier: string;
    facts: {
        role: string | null;
        lifecycleState: string;
        runtime: string | null;
        pendingWorkCount: number;
    };
}
export interface RoleSelectionResult {
    /** The winning seat's DERIVED canonical coordinate (the one string —
     *  tiebreak key AND recorded destination). null = no qualified seat. */
    seat: string | null;
    /** Every evaluated agent seat that did NOT win, with its named
     *  disqualifier — the structured details a resolution failure (and
     *  the proof captures) surface. Qualified-but-outranked seats appear
     *  under `qualified` instead, never here. */
    disqualified: RoleCandidateVerdict[];
    /** The qualified set in final ranked order (winner first) — makes
     *  the load/tiebreak proofs legible. */
    qualified: Array<{
        coordinate: string;
        logicalId: string;
        pendingWorkCount: number;
    }>;
}
/**
 * Select the seat for `role` from the candidate facts. Pure; order of
 * the input array never affects the outcome (commit-4 permutation
 * vector).
 *
 * `harness` = the step's WF-2 pin: when set, a qualified seat must run
 * exactly that runtime; when absent, any AGENT runtime qualifies (the
 * nodeKind gate already excludes infrastructure/terminal).
 */
export declare function selectRoleSeat(input: {
    role: string;
    harness?: string;
    candidates: RoleSeatCandidateFacts[];
}): RoleSelectionResult;
//# sourceMappingURL=workflow-role-resolver.d.ts.map