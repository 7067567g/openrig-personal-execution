import type { Migration } from "../migrate.js";
/**
 * S14 — structured owner-notification metadata on the durable queue transition.
 * Nullable is deliberate: historical and unclassified transitions remain RECORD;
 * no existing audit row is rewritten or inferred from prose.
 */
export declare const ownerNotificationLevelsSchema: Migration;
//# sourceMappingURL=076_owner_notification_levels.d.ts.map