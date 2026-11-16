import type Database from "better-sqlite3";
/**
 * Watchdog history log (PL-004 Phase C; append-only audit writer).
 *
 * Per slice IMPL § Guard Checkpoint Focus item 2:
 * - Pure `not_due` polls are NOT recorded (matches POC; minimizes
 *   table size). Only `sent` / `skipped` / `terminal` outcomes pass
 *   through this log.
 * - Append-only API surface: only `record()` exposed. UPDATE/DELETE
 *   are not exposed. SQLite has no view/role layer so direct SQL
 *   could mutate, but the contract is enforced at this domain
 *   boundary.
 */
export type WatchdogOutcome = "sent" | "skipped" | "terminal";
export interface WatchdogHistoryRecordInput {
    jobId: string;
    evaluatedAt: string;
    outcome: WatchdogOutcome;
    skipReason?: string | null;
    deliveryTargetSession?: string | null;
    deliveryStatus?: string | null;
    deliveryMessage?: string | null;
    evaluationNotes?: Record<string, unknown> | null;
}
export interface WatchdogHistoryEntry {
    historyId: string;
    jobId: string;
    evaluatedAt: string;
    outcome: WatchdogOutcome;
    skipReason: string | null;
    deliveryTargetSession: string | null;
    deliveryStatus: string | null;
    deliveryMessage: string | null;
    evaluationNotes: Record<string, unknown> | null;
}
export declare class WatchdogHistoryLog {
    private readonly db;
    constructor(db: Database.Database);
    /**
     * Append a meaningful evaluation outcome. Returns the persisted entry.
     * Caller MUST NOT invoke this for `not_due` pure-skip outcomes — those
     * are not recorded (per POC + IMPL guidance).
     */
    record(input: WatchdogHistoryRecordInput): WatchdogHistoryEntry;
    listForJob(jobId: string, limit?: number): WatchdogHistoryEntry[];
    listAll(limit?: number): WatchdogHistoryEntry[];
    countForJob(jobId: string): number;
}
//# sourceMappingURL=watchdog-history-log.d.ts.map