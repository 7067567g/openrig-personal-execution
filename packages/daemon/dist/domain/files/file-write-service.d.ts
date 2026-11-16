import { type AllowlistRoot } from "./path-safety.js";
export interface FileWriteRequest {
    rootName: string;
    /** Relative path under the allowlist root; same shape as item 3 routes. */
    path: string;
    content: string;
    /** Caller-known mtime (ISO string) at the time of last read. */
    expectedMtime: string;
    /** Caller-known SHA-256 content hash (hex) at the time of last read. */
    expectedContentHash: string;
    /** Operator session that initiated the write (for the audit row). */
    actor: string;
    /** P21 §4 era-stamp for the audit row: `transport:v1` when the actor came from the transport
     *  header chokepoint; null = claimed-era (the UI/MCP named-deferral path). */
    identityProvenance?: string | null;
}
export interface FileWriteResult {
    /** Resolved canonical absolute path that was written. */
    absolutePath: string;
    /** New mtime after the write (ISO string). */
    newMtime: string;
    /** New SHA-256 content hash (hex) after the write. */
    newContentHash: string;
    /** Byte-count delta (new - prev). */
    byteCountDelta: number;
}
export declare class WriteConflictError extends Error {
    readonly currentMtime: string;
    readonly currentContentHash: string;
    readonly details: Record<string, unknown>;
    constructor(currentMtime: string, currentContentHash: string, details: Record<string, unknown>);
}
export declare class FileWriteError extends Error {
    readonly code: "stat_failed" | "tmp_write_failed" | "rename_failed" | "audit_write_failed" | "target_exists";
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: "stat_failed" | "tmp_write_failed" | "rename_failed" | "audit_write_failed" | "target_exists", message: string, details?: Record<string, unknown> | undefined);
}
export interface FileWriteServiceOpts {
    /** Allowlist roots resolved from env at startup (re-resolved per request is fine; cheap). */
    allowlist: AllowlistRoot[];
    /** Override default audit file location for tests. */
    auditFilePath?: string;
    /** Override Date.now() for tests (returns ISO timestamp). */
    now?: () => Date;
}
export declare class FileWriteService {
    private readonly allowlist;
    private readonly auditFilePath;
    private readonly now;
    constructor(opts: FileWriteServiceOpts);
    /**
     * Atomically write content to an allowlisted file. Throws
     * WriteConflictError on mtime/contentHash mismatch; throws
     * FileWriteError on stat / temp-write / rename / audit failures.
     * Returns FileWriteResult with the new mtime + contentHash on
     * success.
     */
    writeAtomic(req: FileWriteRequest): FileWriteResult;
    /**
     * Atomically CREATE a new allowlisted file (OPR.0.4.4.20 FR-6 — the frozen
     * review export). Exclusive: throws `target_exists` when the file is
     * already there (frozen exports are point-in-time snapshots, never
     * rewritten; re-invoking the freeze for the same approval is an idempotent
     * no-op at the caller). Same temp-write + fsync + audit-row machinery as
     * writeAtomic — one writer family, no parallel write path.
     */
    createAtomic(req: Omit<FileWriteRequest, "expectedMtime" | "expectedContentHash">): FileWriteResult;
    private appendAuditRow;
    /** Test/debug helper: returns the configured audit file path. */
    getAuditFilePath(): string;
}
export declare function sha256Hex(content: Buffer | string): string;
//# sourceMappingURL=file-write-service.d.ts.map