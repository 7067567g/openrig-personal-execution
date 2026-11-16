import type { Migration } from "../migrate.js";
/**
 * P21 I3 — extend the CLAIMED-era vs DERIVED-era audit boundary (plan §4, migration 065) to the
 * QUEUE-SPINE identity-carrying stores. Adds the same NULLABLE `identity_provenance` column to
 * `queue_transitions`, `inbox_entries`, `outbox_entries`, and `stream_items`. The I3 routes' transport
 * chokepoint writes `transport:v1`; **absence IS the claimed-era marker** — no backfill, no re-labeling
 * (the house absent-never-fabricated doctrine). The boundary is per-ROW truth, not a timestamp: each
 * store's rows stay individually honest as I3's surfaces flip at their folds. Additive + nullable —
 * identical contract to 065's `mission_control_actions` column.
 */
export declare const i3IdentityProvenanceSchema: Migration;
//# sourceMappingURL=067_i3_identity_provenance.d.ts.map