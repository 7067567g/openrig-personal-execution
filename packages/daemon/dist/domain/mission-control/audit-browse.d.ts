import type Database from "better-sqlite3";
import { type MissionControlActionEntry } from "./mission-control-action-log.js";
export interface AuditQueryInput {
    qitemId?: string;
    actionVerb?: string;
    actorSession?: string;
    /** ISO timestamp; rows with acted_at >= since are included. */
    since?: string;
    /** ISO timestamp; rows with acted_at <= until are included. */
    until?: string;
    /** Default 50; capped at 200. */
    limit?: number;
    /** Pagination cursor: returns rows whose action_id < beforeId. */
    beforeId?: string;
    /** OPR.0.4.4.19 FR-9 — the scope-approval target filters (the pinned
     *  audit_notes_json shape's read path). These make Packet 2's one-query
     *  UNVERIFIED-stamp cross-check real: filter by the stable scope target
     *  (tier + dot-ID + canonical path) and/or approval scope. */
    scopeTier?: string;
    scopeId?: string;
    scopePath?: string;
    approvalScope?: string;
}
export interface AuditQueryResult {
    rows: MissionControlActionEntry[];
    hasMore: boolean;
    nextBeforeId: string | null;
}
export declare class MissionControlAuditQueryError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, details?: Record<string, unknown> | undefined);
}
export declare class MissionControlAuditBrowse {
    private readonly db;
    constructor(db: Database.Database);
    query(input: AuditQueryInput): AuditQueryResult;
}
//# sourceMappingURL=audit-browse.d.ts.map