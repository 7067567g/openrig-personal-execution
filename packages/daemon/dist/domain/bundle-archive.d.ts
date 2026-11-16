/**
 * Pack a staging directory into a .rigbundle archive (deterministic tar.gz).
 * Writes sibling .sha256 digest file.
 * @returns SHA-256 hex digest of the archive
 */
export declare function pack(stagingDir: string, outputPath: string): Promise<string>;
/**
 * Normalize a tar entry path for safety checks: Windows backslashes to
 * forward slashes so a `..\\escape` or `C:\\…` entry cannot slip past a
 * POSIX-only check.
 */
export declare function normalizeArchiveEntryPath(entryPath: string): string;
/**
 * The single unsafe-entry verdict shared by bundle extraction and inspection.
 * Returns a human-readable reason when the entry must be refused, or `null`
 * when the entry is safe. Rejects symlinks/hardlinks, POSIX-absolute and
 * Windows drive-absolute paths, and dot-dot traversal (POSIX or backslash).
 *
 * One source of truth: `unpack()` and the `/api/bundles/inspect` route both
 * call this so a bundle cannot be refused by one and reported safe by the
 * other. The labels (`SymbolicLink:`, `absolute path:`, `path traversal:`)
 * are part of the refusal contract.
 */
export declare function unsafeArchiveEntryReason(entryPath: string, entryType?: string): string | null;
/**
 * Pre-scan an archive and return every unsafe entry reason (empty when clean).
 * Shared by `unpack()` and the `/api/bundles/inspect` route so both apply the
 * same boundary before any extraction happens.
 */
export declare function collectUnsafeArchiveEntries(archivePath: string): Promise<string[]>;
/**
 * Unpack a .rigbundle archive to a directory.
 * Requires sibling .sha256 digest file. Verifies archive integrity before extraction.
 * Rejects symlinks, hardlinks, path traversal, and absolute paths.
 * Runs content integrity verification after extraction.
 */
export declare function unpack(archivePath: string, outputDir: string): Promise<{
    warnings: string[];
} | undefined>;
/**
 * Verify the archive-level SHA-256 digest.
 * Requires sibling .sha256 file.
 */
export declare function verifyArchiveDigest(archivePath: string): {
    valid: boolean;
    expected: string;
    actual: string;
};
//# sourceMappingURL=bundle-archive.d.ts.map