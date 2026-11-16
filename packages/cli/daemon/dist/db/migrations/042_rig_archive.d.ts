import type { Migration } from "../migrate.js";
/**
 * OPR.0.3.3.19 - rig archive affordance.
 *
 * Adds a soft, reversible archive flag to the local `rigs` row. `archived_at`
 * is NULL for an active rig and an ISO timestamp once archived. This is a
 * visibility/retention flag, NOT a lifecycle state - lifecycle stays a derived
 * runtime/recovery projection. Default daemon reads exclude archived rigs;
 * explicit include/archived-only modes opt in. Mirrors the shipped stream-items
 * `archived_at` precedent (023_stream_items).
 *
 * Append-only: ADD COLUMN + index only. No rigs-row restructure/rebuild/drop;
 * existing rig rows are untouched (STEERING: DB migrations don't destroy data).
 */
export declare const rigArchiveSchema: Migration;
//# sourceMappingURL=042_rig_archive.d.ts.map