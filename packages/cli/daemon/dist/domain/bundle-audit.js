/**
 * Bundle install audit trail (Item 4 / slice-05 Checkpoint 5.1).
 *
 * Append-only JSONL log of bundle install events. Matches the JSONL audit-
 * trail convention used by Transcript / Log Cleanup v0 and UI Enhancement
 * Pack v0 — no new SQLite schema or migration.
 *
 * Default location is ~/.openrig/bundle-audit.jsonl. The writer is a pure
 * data sink: callers (the /api/bundles/install route handler) compose the
 * record at the right moment in the install lifecycle and hand it to
 * BundleAuditWriter.append. The reader exposes a small filter API
 * (rig name + since timestamp) for the /api/bundles/history endpoint and
 * the `rig bundle history` CLI subcommand (both land at Checkpoint 5.2).
 *
 * FsOps injection mirrors the codebase pattern for testability: real
 * implementation reads/writes node:fs; tests substitute an in-memory mock.
 */
import nodePath from "node:path";
/** Append-only writer for bundle install audit records. */
export class BundleAuditWriter {
    opts;
    fs;
    constructor(deps) {
        this.opts = deps.opts;
        this.fs = deps.fsOps;
    }
    /**
     * Append one record to the JSONL file. Creates the parent directory if
     * missing. Each record is one JSON object on its own line (operator can
     * tail -f for live monitoring). Throws on filesystem errors via fsOps.
     */
    append(record) {
        this.fs.mkdirp(nodePath.dirname(this.opts.auditPath));
        const line = `${JSON.stringify(record)}\n`;
        this.fs.appendFile(this.opts.auditPath, line);
    }
}
/** Reader for the bundle install audit JSONL file. */
export class BundleAuditReader {
    opts;
    fs;
    constructor(deps) {
        this.opts = deps.opts;
        this.fs = deps.fsOps;
    }
    /**
     * Return all audit records (optionally filtered). Malformed lines are
     * skipped silently — forward-compat with future record-shape evolutions
     * that don't parse under the current shape; the readable lines still
     * surface. Records are returned in append order (oldest first).
     */
    list(filters) {
        if (!this.fs.exists(this.opts.auditPath))
            return [];
        const content = this.fs.readFile(this.opts.auditPath);
        const lines = content.split("\n").filter((l) => l.length > 0);
        const records = [];
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    records.push(parsed);
                }
            }
            catch {
                // Malformed line — skip silently.
            }
        }
        return applyFilters(records, filters);
    }
}
/** Apply the supported filters to an in-memory record array. */
function applyFilters(records, filters) {
    if (!filters)
        return records;
    let out = records;
    if (filters.rig !== undefined && filters.rig.length > 0) {
        const rigName = filters.rig;
        out = out.filter((r) => r.targetRigName === rigName);
    }
    if (filters.since !== undefined && filters.since.length > 0) {
        const since = filters.since;
        out = out.filter((r) => r.installedAt >= since);
    }
    return out;
}
//# sourceMappingURL=bundle-audit.js.map