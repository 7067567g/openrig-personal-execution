import type { Migration } from "../migrate.js";
/**
 * Project classifications (PL-004 Phase B; L2 Project / Classifier).
 *
 * Per PRD § L2 (`product-specs/coordination-primitive-system/README.md:113,118,136`)
 * + slice IMPL § Write Set:118 + R1 guard (BLOCKER 1): agent-backed
 * classification of stream items. Daemon owns:
 *
 * - Idempotency on stream_item_id (UNIQUE).
 * - Lease validation (delegated to classifier-lease-manager).
 * - L1→L2 referential integrity (FK to stream_items.stream_item_id).
 *
 * Classification fields are agent judgment — daemon does NOT enforce
 * taxonomies on them.
 *
 * Idempotency contract: re-projection of the same stream_item_id MUST
 * fail with structured 409. The first row wins; the second attempt's
 * classification is rejected.
 *
 * Existence contract (R1): classification of a nonexistent stream_item_id
 * MUST fail with structured 400-class `unknown_stream_item` error. Domain
 * layer pre-checks for clean error rendering; FK constraint is a
 * defense-in-depth safety net (PRAGMA foreign_keys = ON in connection.ts).
 */
export declare const projectClassificationsSchema: Migration;
//# sourceMappingURL=028_project_classifications.d.ts.map