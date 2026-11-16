import type Database from "better-sqlite3";
export declare const MISSION_CONTROL_VERBS: readonly ["approve", "deny", "route", "annotate", "hold", "drop", "handoff", "resolve"];
export type MissionControlVerb = (typeof MISSION_CONTROL_VERBS)[number];
export interface MissionControlActionRecordInput {
    actionVerb: MissionControlVerb;
    qitemId: string | null;
    actorSession: string;
    actedAt: string;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    reason?: string | null;
    annotation?: string | null;
    notifyAttempted?: boolean;
    notifyResult?: string | null;
    auditNotes?: Record<string, unknown> | null;
    /** P21 era-stamp: the identity provenance of `actorSession`. The transport chokepoint writes
     *  `transport:v1`; absent/null = claimed-era (pre-verification), never re-labeled. */
    identityProvenance?: string | null;
}
export interface MissionControlActionEntry {
    actionId: string;
    actionVerb: MissionControlVerb;
    qitemId: string | null;
    actorSession: string;
    actedAt: string;
    beforeState: Record<string, unknown> | null;
    afterState: Record<string, unknown> | null;
    reason: string | null;
    annotation: string | null;
    notifyAttempted: boolean;
    notifyResult: string | null;
    auditNotes: Record<string, unknown> | null;
    identityProvenance: string | null;
}
export declare class MissionControlActionLogError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, details?: Record<string, unknown> | undefined);
}
export declare class MissionControlActionLog {
    private readonly db;
    private readonly hasProvenanceCol;
    constructor(db: Database.Database);
    /**
     * Append an action record. Validates verb-specific required fields
     * (annotate → annotation; hold/drop → reason). Designed to compose
     * inside an outer caller-managed transaction (used by the
     * write-contract for the atomic 4-step handoff).
     */
    record(input: MissionControlActionRecordInput): MissionControlActionEntry;
    listRecent(limit?: number): MissionControlActionEntry[];
    listForQitem(qitemId: string, limit?: number): MissionControlActionEntry[];
    listForActor(actorSession: string, limit?: number): MissionControlActionEntry[];
    countAll(): number;
}
//# sourceMappingURL=mission-control-action-log.d.ts.map