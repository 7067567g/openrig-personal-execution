import type { Migration } from "../migrate.js";
/**
 * Outbox entries (PL-004 Phase A; symmetric to inbox).
 *
 * Sender-side audit of dispatched items. Useful for senders that want a
 * record of sent items independent of receiver behavior. Daemon-managed
 * write; idempotent on outbox_id.
 *
 * delivery_state enum: pending | delivered | failed
 */
export declare const outboxEntriesSchema: Migration;
//# sourceMappingURL=027_outbox_entries.d.ts.map