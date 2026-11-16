import { ulid } from "ulid";
export class PackageRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    createPackage(opts) {
        const id = ulid();
        this.db
            .prepare("INSERT INTO packages (id, name, version, source_kind, source_ref, manifest_hash, summary) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .run(id, opts.name, opts.version, opts.sourceKind, opts.sourceRef, opts.manifestHash, opts.summary ?? null);
        return this.getPackage(id);
    }
    getPackage(id) {
        const row = this.db
            .prepare("SELECT * FROM packages WHERE id = ?")
            .get(id);
        return row ? this.rowToPackage(row) : null;
    }
    findByNameVersion(name, version) {
        const row = this.db
            .prepare("SELECT * FROM packages WHERE name = ? AND version = ?")
            .get(name, version);
        return row ? this.rowToPackage(row) : null;
    }
    listPackages() {
        const rows = this.db
            .prepare("SELECT * FROM packages ORDER BY created_at DESC")
            .all();
        return rows.map((r) => this.rowToPackage(r));
    }
    listPackageSummaries() {
        const rows = this.db
            .prepare(`
        SELECT p.*,
          COUNT(pi.id) AS install_count,
          (SELECT status FROM package_installs WHERE package_id = p.id ORDER BY created_at DESC, rowid DESC LIMIT 1) AS latest_install_status
        FROM packages p
        LEFT JOIN package_installs pi ON pi.package_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `)
            .all();
        return rows.map((r) => ({
            ...this.rowToPackage(r),
            installCount: r.install_count,
            latestInstallStatus: r.latest_install_status,
        }));
    }
    rowToPackage(row) {
        return {
            id: row.id,
            name: row.name,
            version: row.version,
            sourceKind: row.source_kind,
            sourceRef: row.source_ref,
            manifestHash: row.manifest_hash,
            summary: row.summary,
            createdAt: row.created_at,
        };
    }
}
//# sourceMappingURL=package-repository.js.map