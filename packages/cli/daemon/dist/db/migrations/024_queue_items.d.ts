import type { Migration } from "../migrate.js";
/**
 * L3 — Queue (PL-004 Phase A).
 *
 * Owned work for a specific seat. Carries state, provenance, the closure
 * obligation, and the daemon-tracked nudge result. Live runtime state is
 * SQLite-canonical; markdown queue mirrors are read-only debug/export only.
 *
 * State enum (validated at the domain layer):
 *   pending | in-progress | done | blocked | failed | denied | canceled | handed-off
 *
 * Closure-reason enum (required on `done` transitions; hot-potato strict-rejection):
 *   handed_off_to | blocked_on | denied | canceled | no-follow-on | escalation
 *
 * `chain_of_record` and `tags` carry JSON arrays (TEXT-encoded) for forward
 * compat with structured query layers.
 */
export declare const queueItemsSchema: Migration;
//# sourceMappingURL=024_queue_items.d.ts.map