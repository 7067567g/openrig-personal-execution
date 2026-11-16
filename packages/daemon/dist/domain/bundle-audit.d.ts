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
/** A single bundle install audit row. */
export interface BundleAuditRecord {
    /** ISO timestamp of when the install event was recorded. */
    installedAt: string;
    /** Source bundle path the install operated on. */
    bundlePath: string;
    /** SHA-256 archive hash (when available from bundle's sibling digest). */
    archiveHash?: string;
    /** ULID of the rig the install targeted (when applicable). */
    targetRigId?: string;
    /** Name of the rig the install targeted (when applicable). */
    targetRigName?: string;
    /** Hostname recorded in the bundle's provenance (Item 1), when present. */
    sourceHost?: string;
    /** Daemon version at install time. */
    daemonVersion?: string;
    /** CLI version at install time (when CLI sent it; Item 1 + Item 2 path). */
    cliVersion?: string;
    /** Install outcome — keep honest (partial = some stages ok, some not). */
    outcome: "success" | "failed" | "partial";
    /** Declared bundle contents that failed to route; the install itself still ran. */
    routingFailures?: Array<{
        kind: string;
        error: string;
    }>;
}
/** Filesystem injection point — real impl wraps node:fs. Tests substitute in-memory. */
export interface BundleAuditFsOps {
    appendFile: (path: string, content: string) => void;
    readFile: (path: string) => string;
    exists: (path: string) => boolean;
    mkdirp: (path: string) => void;
}
/** Configuration for the audit writer + reader. */
export interface BundleAuditOpts {
    /** Absolute path to the JSONL file (default location: ~/.openrig/bundle-audit.jsonl). */
    auditPath: string;
}
/** Append-only writer for bundle install audit records. */
export declare class BundleAuditWriter {
    private opts;
    private fs;
    constructor(deps: {
        opts: BundleAuditOpts;
        fsOps: BundleAuditFsOps;
    });
    /**
     * Append one record to the JSONL file. Creates the parent directory if
     * missing. Each record is one JSON object on its own line (operator can
     * tail -f for live monitoring). Throws on filesystem errors via fsOps.
     */
    append(record: BundleAuditRecord): void;
}
/** Filters supported by the audit reader (subset of /api/bundles/history). */
export interface BundleAuditFilters {
    /** When set, only return records whose targetRigName equals this value. */
    rig?: string;
    /** When set, only return records whose installedAt is >= this ISO timestamp. */
    since?: string;
}
/** Reader for the bundle install audit JSONL file. */
export declare class BundleAuditReader {
    private opts;
    private fs;
    constructor(deps: {
        opts: BundleAuditOpts;
        fsOps: BundleAuditFsOps;
    });
    /**
     * Return all audit records (optionally filtered). Malformed lines are
     * skipped silently — forward-compat with future record-shape evolutions
     * that don't parse under the current shape; the readable lines still
     * surface. Records are returned in append order (oldest first).
     */
    list(filters?: BundleAuditFilters): BundleAuditRecord[];
}
//# sourceMappingURL=bundle-audit.d.ts.map