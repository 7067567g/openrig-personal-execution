import type { Migration } from "../migrate.js";
/**
 * L1 — Stream (PL-004 Phase A).
 *
 * Append-only intake/audit root for the coordination primitive. Items are
 * immutable after emit; ordered by `(ts_emitted, stream_sort_key)`. Hints
 * are advisory; classifier (L2, future Phase B) is authoritative on routing.
 *
 * Indexes:
 *   - PRIMARY KEY on stream_item_id (ULID; monotonic per host)
 *   - source-session lookup
 *   - hint-destination lookup
 *   - composite (ts_emitted, stream_sort_key) for chronological cursor pagination
 */
export declare const streamItemsSchema: Migration;
//# sourceMappingURL=023_stream_items.d.ts.map