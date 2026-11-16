import { ulid } from "ulid";
export class InstallRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    createInstall(packageId, targetRoot, scope, bootstrapId) {
        const id = ulid();
        if (bootstrapId) {
            this.db
                .prepare("INSERT INTO package_installs (id, package_id, target_root, scope, bootstrap_id) VALUES (?, ?, ?, ?, ?)")
                .run(id, packageId, targetRoot, scope, bootstrapId);
        }
        else {
            this.db
                .prepare("INSERT INTO package_installs (id, package_id, target_root, scope) VALUES (?, ?, ?, ?)")
                .run(id, packageId, targetRoot, scope);
        }
        return this.getInstall(id);
    }
    updateInstallStatus(installId, status) {
        const timestampCol = status === "applied" ? "applied_at" : status === "rolled_back" ? "rolled_back_at" : null;
        if (timestampCol) {
            this.db
                .prepare(`UPDATE package_installs SET status = ?, ${timestampCol} = datetime('now') WHERE id = ?`)
                .run(status, installId);
        }
        else {
            this.db
                .prepare("UPDATE package_installs SET status = ? WHERE id = ?")
                .run(status, installId);
        }
    }
    getInstall(installId) {
        const row = this.db
            .prepare("SELECT * FROM package_installs WHERE id = ?")
            .get(installId);
        return row ? this.rowToInstall(row) : null;
    }
    listInstallSummaries(packageId) {
        const rows = this.db
            .prepare(`
        SELECT pi.*,
          (SELECT COUNT(*) FROM install_journal ij WHERE ij.install_id = pi.id AND ij.action != 'rollback') AS applied_count
        FROM package_installs pi
        WHERE pi.package_id = ?
        ORDER BY pi.created_at DESC, pi.rowid DESC
      `)
            .all(packageId);
        return rows.map((r) => ({
            ...this.rowToInstall(r),
            appliedCount: r.applied_count,
            deferredCount: null,
        }));
    }
    listInstalls(packageId) {
        if (packageId) {
            const rows = this.db
                .prepare("SELECT * FROM package_installs WHERE package_id = ? ORDER BY created_at")
                .all(packageId);
            return rows.map((r) => this.rowToInstall(r));
        }
        const rows = this.db
            .prepare("SELECT * FROM package_installs ORDER BY created_at")
            .all();
        return rows.map((r) => this.rowToInstall(r));
    }
    createJournalEntry(opts) {
        const id = ulid();
        // Compute next seq for this install
        const maxSeq = this.db
            .prepare("SELECT MAX(seq) as max_seq FROM install_journal WHERE install_id = ?")
            .get(opts.installId);
        const seq = (maxSeq.max_seq ?? 0) + 1;
        this.db
            .prepare("INSERT INTO install_journal (id, install_id, seq, action, export_type, classification, target_path, backup_path, before_hash, after_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .run(id, opts.installId, seq, opts.action, opts.exportType, opts.classification, opts.targetPath, opts.backupPath ?? null, opts.beforeHash ?? null, opts.afterHash ?? null, opts.status ?? "applied");
        return this.getJournalEntry(id);
    }
    getJournalEntries(installId) {
        const rows = this.db
            .prepare("SELECT * FROM install_journal WHERE install_id = ? ORDER BY seq ASC")
            .all(installId);
        return rows.map((r) => this.rowToJournalEntry(r));
    }
    getJournalEntry(id) {
        const row = this.db
            .prepare("SELECT * FROM install_journal WHERE id = ?")
            .get(id);
        return row ? this.rowToJournalEntry(row) : null;
    }
    rowToInstall(row) {
        return {
            id: row.id,
            packageId: row.package_id,
            targetRoot: row.target_root,
            scope: row.scope,
            status: row.status,
            riskTier: row.risk_tier,
            createdAt: row.created_at,
            appliedAt: row.applied_at,
            rolledBackAt: row.rolled_back_at,
        };
    }
    rowToJournalEntry(row) {
        return {
            id: row.id,
            installId: row.install_id,
            seq: row.seq,
            action: row.action,
            exportType: row.export_type,
            classification: row.classification,
            targetPath: row.target_path,
            backupPath: row.backup_path,
            beforeHash: row.before_hash,
            afterHash: row.after_hash,
            status: row.status,
            createdAt: row.created_at,
        };
    }
}
//# sourceMappingURL=install-repository.js.map