import type { Migration } from "../migrate.js";
/** Keep inventory folds on their event types instead of scanning activity history.
 * Fleet and rig restore reads need different leading keys to retain their order. */
export declare const inventoryEventIndexesSchema: Migration;
//# sourceMappingURL=084_inventory_event_indexes.d.ts.map