import type { Migration } from "../migrate.js";
/**
 * Watchdog history (PL-004 Phase C; append-only audit log).
 *
 * Per PRD § Watchdog + slice IMPL § Guard Checkpoint Focus item 2:
 * append-only history of meaningful watchdog events. Pure `not_due`
 * polls are NOT recorded (matches POC; minimizes table size). Only
 * `sent` (delivery executed), `skipped` (policy ran but skipped per
 * its own logic — e.g., suppress_if_recent_success or
 * no_actionable_artifacts), and `terminal` (policy declared job done)
 * are recorded.
 *
 * Append-only contract: writers only INSERT. UPDATE/DELETE are not
 * exposed by WatchdogHistoryLog API; direct SQL UPDATE/DELETE would
 * succeed at the DB level (SQLite has no view/role layer) but is a
 * contract violation enforced at the domain-layer API boundary.
 *
 * Outcome enum:
 *   sent     - policy.evaluate() returned action=send and delivery executed
 *   skipped  - policy.evaluate() returned action=skip (with reason)
 *   terminal - policy.evaluate() returned action=terminal (job declared done)
 *
 * FK to watchdog_jobs(job_id) for referential integrity. Indexes on
 * (job_id, evaluated_at DESC) for "recent history for one job" queries
 * and (outcome, evaluated_at DESC) for cross-job outcome queries.
 */
export declare const watchdogHistorySchema: Migration;
//# sourceMappingURL=032_watchdog_history.d.ts.map