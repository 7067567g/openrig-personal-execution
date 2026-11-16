import { type ClaudeStatuslineReading } from "./provider-signals.js";
import type { ProviderSignal } from "./provider-types.js";
export interface ProviderUsageCacheFs {
    readFile(path: string): string;
    writeFile(path: string, content: string): void;
    rename(from: string, to: string): void;
    exists(path: string): boolean;
}
/** The on-disk provider_usage cache shape (authored by the Claude statusline sidecar). */
export interface ProviderUsageCache {
    seatSession: string;
    /** Present only when the statusline carried valid Pro/Max rate_limits. */
    accountKind?: "subscription";
    asOf: string;
    /** Present only when the statusline carried a rate_limits object. */
    rateLimits?: ClaudeStatuslineReading;
    staleAfter?: string;
}
/**
 * Atomic write: serialize to a tmp sibling, then rename over the target. rename(2) is atomic on the
 * same filesystem, so a concurrent reader sees EITHER the old file OR the fully-written new one —
 * never a half-written (torn) read. The sidecar uses this so the daemon never parses a partial cache.
 */
export declare function writeProviderUsageCacheAtomic(fs: ProviderUsageCacheFs, path: string, cache: ProviderUsageCache): void;
export interface ClaudeSeatRef {
    seatSession: string;
}
export interface ClaudeUsageReaderDeps {
    /** The live Claude seats to read provider_usage for. */
    listClaudeSeats: () => ClaudeSeatRef[];
    /** Raw cache JSON for a seat, or null if the cache file is absent (pre-first-response). Never throws. */
    readCacheRaw: (seatSession: string) => string | null;
    now: () => string;
}
/**
 * Read each Claude seat's provider_usage cache → provider_statusline rows via
 * claudeStatuslineSignals. Explicit unknown rows for absent cache (no_statusline_cache_yet) and
 * cache-present-but-no/-malformed windows (empty_reading).
 * Never throws — a malformed cache is treated as present-with-no-windows, not a crash.
 */
export declare function collectClaudeStatuslineSignals(deps: ClaudeUsageReaderDeps): ProviderSignal[];
/** Read the seat-keyed cache directory using the same path consumed by daemon startup. */
export declare function collectClaudeSignalsFromProviderUsageDirectory(directory: string, now?: () => string, legacyDirectory?: string): ProviderSignal[];
//# sourceMappingURL=claude-usage-reader.d.ts.map