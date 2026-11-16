/**
 * A path-like pack ref is one or more `/`-separated segments, each a safe segment. Empty ref, an
 * absolute path (empty leading segment), a double/trailing slash (empty segment), a '.'/'..'
 * traversal segment, or any injection char in a segment → NOT safe.
 */
export declare function isSafePackRef(ref: string): boolean;
/** Throwing form for write/resolve sites — packs must stay inside the context store root. */
export declare function assertSafePackRef(ref: string): void;
/** A pack version must be a single bounded token (no separators, whitespace, '@', or ':'). */
export declare function isSafePackVersion(version: string): boolean;
//# sourceMappingURL=ref-safety.d.ts.map