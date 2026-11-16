import type { Migration } from "../migrate.js";
/**
 * Inbox entries (PL-004 Phase A; mailbox-style asynchronous deposit).
 *
 * Inbox is the canonical async/bulk path,
 * NOT a contention fallback. Any authenticated sender may inbox-drop with
 * attribution + audit. Receiver chooses absorb (promote to main queue) or
 * deny (reject with reason). Idempotent on inbox_id.
 *
 * State enum: pending | absorbed | denied
 * `absorbed_qitem_id` records which queue_item the absorbed entry became.
 */
export declare const inboxEntriesSchema: Migration;
//# sourceMappingURL=026_inbox_entries.d.ts.map