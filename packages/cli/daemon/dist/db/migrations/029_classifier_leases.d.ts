import type { Migration } from "../migrate.js";
/**
 * Classifier leases (PL-004 Phase B; single-writer lease).
 *
 * Per PRD § L2: agent-backed classifier with daemon-enforced single-writer
 * lease (TTL-based) + deadness detection (via whoami-service / node-inventory)
 * + operator-verb reclaim. Single-writer enforced via partial UNIQUE index
 * on state='active' (SQLite >= 3.8 supports partial indexes; OpenRig's
 * better-sqlite3 ships SQLite 3.45+ so this is safe).
 *
 * State enum: active | expired | reclaimed
 *   active    — lease is current; classifier_session may project
 *   expired   — TTL passed AND heartbeat went stale; lease no longer valid
 *   reclaimed — operator-verb reclaim took the lease away from the previous holder
 *
 * Reclaim is OPERATOR-VERB ONLY: rig project --reclaim-classifier [--if-dead].
 * Daemon does NOT auto-reclaim on its own evaluation. expired→active requires
 * an explicit acquire call from a NEW classifier session (which gets a new
 * lease_id row).
 */
export declare const classifierLeasesSchema: Migration;
//# sourceMappingURL=029_classifier_leases.d.ts.map