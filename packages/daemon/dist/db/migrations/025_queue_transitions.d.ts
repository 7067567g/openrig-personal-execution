import type { Migration } from "../migrate.js";
/**
 * L3 — Queue transitions append-only log (PL-004 Phase A).
 *
 * Every state mutation on a queue_item is appended here; the queue_items.state
 * column is the latest transition's value. This log is the authoritative
 * audit trail for hot-potato closure reasoning, watchdog evaluation, and
 * future workflow-runtime transactional-scribe semantics (Phase D).
 *
 * Append-only: no UPDATE / DELETE on this table from domain code.
 */
export declare const queueTransitionsSchema: Migration;
//# sourceMappingURL=025_queue_transitions.d.ts.map