import { ulid } from "ulid";
export class BootstrapRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    createRun(sourceKind, sourceRef) {
        const id = ulid();
        this.db.prepare("INSERT INTO bootstrap_runs (id, source_kind, source_ref) VALUES (?, ?, ?)").run(id, sourceKind, sourceRef);
        return this.getRun(id);
    }
    getRun(id) {
        const row = this.db.prepare("SELECT * FROM bootstrap_runs WHERE id = ?")
            .get(id);
        return row ? this.rowToRun(row) : null;
    }
    listRuns() {
        const rows = this.db.prepare("SELECT * FROM bootstrap_runs ORDER BY created_at DESC, rowid DESC")
            .all();
        return rows.map((r) => this.rowToRun(r));
    }
    updateRunStatus(id, status, opts) {
        if (opts?.rigId) {
            this.db.prepare("UPDATE bootstrap_runs SET status = ?, rig_id = ?, applied_at = ? WHERE id = ?")
                .run(status, opts.rigId, opts.appliedAt ?? new Date().toISOString(), id);
        }
        else if (status === "completed" || status === "failed" || status === "partial") {
            this.db.prepare("UPDATE bootstrap_runs SET status = ?, applied_at = ? WHERE id = ?")
                .run(status, opts?.appliedAt ?? new Date().toISOString(), id);
        }
        else {
            this.db.prepare("UPDATE bootstrap_runs SET status = ? WHERE id = ?")
                .run(status, id);
        }
    }
    journalAction(bootstrapId, seq, actionKind, subjectType, subjectName, status, opts) {
        const id = ulid();
        this.db.prepare(`INSERT INTO bootstrap_actions (id, bootstrap_id, seq, action_kind, subject_type, subject_name, provider, command_preview, status, detail_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, bootstrapId, seq, actionKind, subjectType, subjectName, opts?.provider ?? null, opts?.commandPreview ?? null, status, opts?.detailJson ?? null);
        return this.getAction(id);
    }
    getRunActions(bootstrapId) {
        const rows = this.db.prepare("SELECT * FROM bootstrap_actions WHERE bootstrap_id = ? ORDER BY seq ASC").all(bootstrapId);
        return rows.map((r) => this.rowToAction(r));
    }
    getAction(id) {
        const row = this.db.prepare("SELECT * FROM bootstrap_actions WHERE id = ?")
            .get(id);
        return row ? this.rowToAction(row) : null;
    }
    rowToRun(row) {
        return {
            id: row.id,
            sourceKind: row.source_kind,
            sourceRef: row.source_ref,
            status: row.status,
            rigId: row.rig_id,
            createdAt: row.created_at,
            appliedAt: row.applied_at,
        };
    }
    rowToAction(row) {
        return {
            id: row.id,
            bootstrapId: row.bootstrap_id,
            seq: row.seq,
            actionKind: row.action_kind,
            subjectType: row.subject_type,
            subjectName: row.subject_name,
            provider: row.provider,
            commandPreview: row.command_preview,
            status: row.status,
            detailJson: row.detail_json,
            createdAt: row.created_at,
        };
    }
}
//# sourceMappingURL=bootstrap-repository.js.map