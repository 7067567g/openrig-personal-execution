export interface AllowlistRoot {
    /** Operator-supplied display name (e.g., "workspace"). */
    name: string;
    /** Canonical absolute path on disk. */
    canonicalPath: string;
}
export declare class FilePathSafetyError extends Error {
    readonly code: "root_unknown" | "path_escape" | "path_invalid" | "stat_failed" | "not_a_file" | "not_a_directory";
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: "root_unknown" | "path_escape" | "path_invalid" | "stat_failed" | "not_a_file" | "not_a_directory", message: string, details?: Record<string, unknown> | undefined);
}
/**
 * Decodes a raw `name:/abs/path,name:/abs/path` allowlist string into
 * canonical AllowlistRoot[]. Whitespace around delimiters trimmed.
 * Invalid pairs (no colon, empty name, non-absolute path) silently
 * skipped. Duplicate names: last wins. Same shape both env-var and
 * settings-file-resolved values produce.
 */
export declare function decodeAllowlist(raw: string): AllowlistRoot[];
/**
 * Reads the allowlist env var directly and returns the parsed root list.
 * Preserved for backward-compat callers; v0 callers prefer the resolved
 * settings-store path which honors env > settings-file > empty.
 */
export declare function readAllowlistFromEnv(env?: NodeJS.ProcessEnv): AllowlistRoot[];
/**
 * Resolves a relative path against an allowlist root. Throws
 * FilePathSafetyError on any unsafe condition. Returns the
 * canonical absolute path on success. Caller is expected to stat
 * the result to distinguish file/directory.
 *
 * Path-safety algorithm:
 *   1. Validate the root exists in the allowlist (reject "root_unknown").
 *   2. Reject relative paths that look absolute or contain `..`
 *      segments (reject "path_invalid" / "path_escape").
 *   3. Resolve the relative path against the canonical root.
 *   4. Resolve symlinks: if the realpath does not start with the
 *      canonical root + path separator, reject "path_escape".
 *   5. The base case `path = ""` resolves to the root itself (allowed
 *      so callers can list the root directory).
 */
export declare function resolveAllowedPath(allowlist: AllowlistRoot[], rootName: string, relativePath: string): string;
/** Convenience: resolve + assert the result is an existing regular file. */
export declare function resolveAllowedFile(allowlist: AllowlistRoot[], rootName: string, relativePath: string): string;
/** Convenience: resolve + assert the result is an existing directory. */
export declare function resolveAllowedDirectory(allowlist: AllowlistRoot[], rootName: string, relativePath: string): string;
//# sourceMappingURL=path-safety.d.ts.map