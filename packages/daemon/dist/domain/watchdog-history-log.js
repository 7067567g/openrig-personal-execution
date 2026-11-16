import { ulid } from "ulid";
export class WatchdogHistoryLog {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Append a meaningful evaluation outcome. Returns the persisted entry.
     * Caller MUST NOT invoke this for `not_due` pure-skip outcomes — those
     * are not recorded (per POC + IMPL guidance).
     */
    record(input) {
        const historyId = ulid();
        this.db
            .prepare(`INSERT INTO watchdog_history (
          history_id, job_id, evaluated_at, outcome,
          skip_reason, delivery_target_session, delivery_status,
          delivery_message, evaluation_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(historyId, input.jobId, input.evaluatedAt, input.outcome, input.skipReason ?? null, input.deliveryTargetSession ?? null, input.deliveryStatus ?? null, input.deliveryMessage ?? null, input.evaluationNotes ? JSON.stringify(input.evaluationNotes) : null);
        return {
            historyId,
            jobId: input.jobId,
            evaluatedAt: input.evaluatedAt,
            outcome: input.outcome,
            skipReason: input.skipReason ?? null,
            deliveryTargetSession: input.deliveryTargetSession ?? null,
            deliveryStatus: input.deliveryStatus ?? null,
            deliveryMessage: input.deliveryMessage ?? null,
            evaluationNotes: input.evaluationNotes ?? null,
        };
    }
    listForJob(jobId, limit = 50) {
        const rows = this.db
            .prepare(`SELECT * FROM watchdog_history WHERE job_id = ?
         ORDER BY evaluated_at DESC, history_id DESC LIMIT ?`)
            .all(jobId, limit);
        return rows.map(rowToEntry);
    }
    listAll(limit = 100) {
        const rows = this.db
            .prepare(`SELECT * FROM watchdog_history
         ORDER BY evaluated_at DESC, history_id DESC LIMIT ?`)
            .all(limit);
        return rows.map(rowToEntry);
    }
    countForJob(jobId) {
        const row = this.db
            .prepare(`SELECT COUNT(*) AS n FROM watchdog_history WHERE job_id = ?`)
            .get(jobId);
        return row.n;
    }
}
function rowToEntry(row) {
    return {
        historyId: row.history_id,
        jobId: row.job_id,
        evaluatedAt: row.evaluated_at,
        outcome: row.outcome,
        skipReason: row.skip_reason,
        deliveryTargetSession: row.delivery_target_session,
        deliveryStatus: row.delivery_status,
        deliveryMessage: row.delivery_message,
        evaluationNotes: row.evaluation_notes ? JSON.parse(row.evaluation_notes) : null,
    };
}
//# sourceMappingURL=watchdog-history-log.js.map