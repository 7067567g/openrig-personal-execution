import type { SnapshotData, Session, SnapshotOccupantState } from "./types.js";
/** The minimal row shape the ladder needs — satisfied by Session and by the
 *  preview's narrower session rows alike, so ONE ladder serves every consumer
 *  without a copied variant. */
export interface OccupantCandidateRow {
    id: string;
    nodeId: string;
    status: string | null;
}
export type ActiveOccupantResolution<T extends OccupantCandidateRow> = {
    kind: "resolved";
    session: T;
} | {
    kind: "none";
} | {
    kind: "ambiguous";
    candidateIds: string[];
    detail: string;
};
export type ActiveSnapshotSessionResolution = {
    kind: "resolved";
    session: Session;
} | {
    kind: "none";
} | {
    kind: "ambiguous";
    candidateIds: string[];
    detail: string;
};
/** The four-way ladder (moved from restore-orchestrator.ts, behavior
 *  byte-faithful; generic over the row shape so no consumer copies it). */
export declare function resolveActiveOccupantRow<T extends OccupantCandidateRow>(sessions: T[], relationMap: Record<string, string | null> | undefined, nodeId: string): ActiveOccupantResolution<T>;
/** The snapshot-shaped entry point (the original public signature; a thin
 *  wrapper so execution call sites are unchanged). */
export declare function resolveActiveSnapshotSession(data: SnapshotData, nodeId: string): ActiveSnapshotSessionResolution;
/** A seat with no occupant (none) whose history still carries a resume token. Execution and the
 *  plan preview both stop such a seat for a decision rather than fresh-priming it: it HAD a session,
 *  and which earlier conversation to resume is not theirs to guess. Shared so the two cannot drift.
 *  The seat's newest row (ids are ULIDs) carries its current restore policy: under anything but
 *  resume_if_possible it starts fresh as before. Otherwise returns a row with a recorded token, or null. */
export declare function absentSeatResumeHistory<T extends {
    id: string;
    nodeId: string;
    resumeType: string | null;
    resumeToken: string | null;
    restorePolicy?: string | null;
}>(sessions: T[], nodeId: string): T | null;
/** The stop-for-decision explanation for such a seat, worded once for apply and preview. */
export declare function absentSeatResumeHistoryError(logicalId: string, resumeType: string | null, rigName: string): string;
/** One wording for the loud failure everywhere — divergent phrasings would be
 *  a second copy of the truth. */
export declare function activeOccupantAmbiguityError(candidateIds: string[], detail?: string): string;
/** The CAPTURE rule, shared verbatim by SnapshotCapture and the live
 *  no-snapshot preview so the two sibling derivations cannot drift:
 *  exactly one RUNNING row for a node -> its id; otherwise -> explicit null
 *  (recorded honestly; restore resolves it loudly instead of guessing). */
export declare function deriveActiveSessionIdByNode(sessions: OccupantCandidateRow[], nodeIds: string[]): Record<string, string | null>;
/** Capture the same live relation without collapsing absent and ambiguous. */
export declare function deriveActiveOccupantsByNode(sessions: OccupantCandidateRow[], nodeIds: string[]): Record<string, SnapshotOccupantState>;
/** Reboot capture equivalent: resolve one durable non-terminal occupant when
 * possible, otherwise preserve the exact absent/ambiguous candidate set. */
export declare function deriveRehydrateOccupantsByNode(sessions: OccupantCandidateRow[], nodeIds: string[], recorded?: Record<string, string | null>): Record<string, SnapshotOccupantState>;
/** Reboot-only capture rule. Startup reconciliation has already changed the
 * lost process's row from running to detached, so the ordinary live-capture
 * rule cannot identify it. Reuse the legacy relation ladder over durable rows:
 * one non-terminal row, or one uniquely-running row among several, is enough;
 * every ambiguous shape remains explicit null and therefore fails closed. */
export declare function deriveRehydrateSessionIdByNode(sessions: OccupantCandidateRow[], nodeIds: string[], recorded?: Record<string, string | null>): Record<string, string | null>;
//# sourceMappingURL=active-occupant.d.ts.map