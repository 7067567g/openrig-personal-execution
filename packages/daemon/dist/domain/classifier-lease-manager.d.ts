import type Database from "better-sqlite3";
import type { EventBus } from "./event-bus.js";
/**
 * Classifier lease manager (PL-004 Phase B).
 *
 * Daemon-enforced single-writer lease for the project (classifier) primitive.
 * Per PRD § L2 hard rule + slice IMPL § Guard Checkpoint Focus item 2:
 *
 * - Single-writer: at most one lease in `state='active'` at any time, enforced
 *   via partial UNIQUE index `idx_classifier_leases_active_singleton`.
 * - TTL-based expiry: every lease has an `expires_at` (acquired_at + ttlMs).
 * - Heartbeat: `last_heartbeat` is updated by the lease holder. Stale heartbeat
 *   past TTL signals deadness.
 * - Deadness detection: caller of `evaluateDeadness` is the project verb path
 *   OR a watchdog. The manager itself does NOT auto-reclaim — only marks
 *   `expired` when heartbeat is stale.
 * - Reclaim is OPERATOR-VERB ONLY: `rig project --reclaim-classifier
 *   [--if-dead]`. Daemon does NOT auto-reclaim. The reclaim path takes the
 *   active lease away from the previous holder and emits classifier.reclaimed.
 *
 * Pattern mirrors Phase A's hot-potato-enforcer.ts shape: pure validation +
 * lifecycle methods, no Hono. Routes import this; this does not import routes.
 */
export declare const LEASE_STATES: readonly ["active", "expired", "reclaimed"];
export type LeaseState = (typeof LEASE_STATES)[number];
export interface ClassifierLease {
    leaseId: string;
    classifierSession: string;
    acquiredAt: string;
    expiresAt: string;
    lastHeartbeat: string;
    state: LeaseState;
    reclaimedBySession: string | null;
    reclaimReason: string | null;
}
export declare class ClassifierLeaseError extends Error {
    readonly code: string;
    readonly meta: Record<string, unknown> | undefined;
    constructor(code: string, message: string, meta?: Record<string, unknown>);
}
export interface ClassifierLeaseManagerOptions {
    ttlMs?: number;
    /** For tests: inject a deterministic clock. Defaults to `() => new Date()`. */
    now?: () => Date;
    /**
     * Liveness check (per PRD: via whoami-service / node-inventory). Returns
     * true if the session is still alive. The lease-manager calls this when
     * evaluating deadness; if the function returns false AND the lease's
     * heartbeat is stale, the lease is marked expired.
     *
     * Defaults to `() => true` (no liveness check; tests can stub).
     */
    isAlive?: (classifierSession: string) => boolean;
}
export declare class ClassifierLeaseManager {
    readonly db: Database.Database;
    private readonly eventBus;
    private readonly ttlMs;
    private readonly now;
    private isAlive;
    constructor(db: Database.Database, eventBus: EventBus, opts?: ClassifierLeaseManagerOptions);
    /**
     * Wire post-construction liveness check (used by startup.ts when
     * whoami-service is constructed later in the dep graph).
     */
    attachIsAlive(check: (classifierSession: string) => boolean): void;
    /**
     * Acquire the active lease for a classifier session. Fails with
     * `lease_held` (409) if another session currently holds an active lease
     * AND that session is alive. If the held lease is by a dead session, the
     * caller should first invoke `evaluateDeadness` (which marks it expired)
     * or use the operator reclaim path.
     *
     * Idempotent for the SAME classifier_session while its lease is unexpired:
     * re-calling acquire returns the existing lease unchanged (heartbeat is
     * updated separately via `heartbeat`). If the holder's own lease has passed
     * its TTL, acquire expires it and issues a NEW lease id, so a result bound to
     * the old lease id can no longer be written (S02 P1).
     */
    acquire(classifierSession: string): ClassifierLease;
    /** Expire the caller's own TTL-passed lease and issue a fresh one, atomically. */
    private replaceExpiredOwnLease;
    private insertActiveLease;
    private isPastTtl;
    /**
     * Heartbeat from the lease holder. Updates `last_heartbeat` and extends
     * `expires_at` by the TTL (sliding-window TTL semantics).
     */
    heartbeat(leaseId: string, classifierSession: string): ClassifierLease;
    /**
     * Evaluate deadness for the currently-active lease. If the lease's
     * heartbeat is stale (now > expires_at) OR the holder is reported dead
     * by `isAlive`, mark the lease expired and emit classifier.lease_expired
     * + classifier.dead. Returns the (now-expired) lease, or null if no
     * active lease exists or it remains alive.
     *
     * Called by: project verb path (before acquire, to clear dead leases),
     * watchdog (periodic sweep), or operator-driven check.
     *
     * Per PRD: this method does NOT reclaim — it only marks expired. The
     * next `acquire` call by ANY session can then succeed (since the partial
     * UNIQUE on state='active' is now empty).
     */
    evaluateDeadness(): ClassifierLease | null;
    /**
     * Operator-verb reclaim. Per PRD § L2 hard rule: ONLY this path may take
     * an active lease away from its holder. Daemon does NOT auto-reclaim.
     *
     * - If `ifDead`: only succeed when isAlive(holder) returns false. If the
     *   holder is alive, refuse with `lease_still_active`.
     * - If `!ifDead`: take the lease unconditionally.
     *
     * Marks the active lease state='reclaimed', records reclaimed_by_session
     * + reclaim_reason, and emits classifier.reclaimed. The next acquire
     * (by ANY session) can then succeed.
     */
    reclaim(byClassifierSession: string, opts?: {
        ifDead?: boolean;
        reason?: string;
    }): ClassifierLease;
    /**
     * Validation hook used by project-classifier: returns the active lease
     * iff the supplied session holds it, else throws. Centralizes the
     * "must hold the lease to project" check.
     *
     * With `leaseId` (S02 P1), the caller must also hold THAT lease: a result
     * computed under a replaced lease is refused with `lease_mismatch`, even when
     * the same session holds the new lease. Safe to call inside a write
     * transaction (reads only).
     */
    requireActiveHolder(classifierSession: string, leaseId?: string): ClassifierLease;
    getActiveLease(): ClassifierLease | null;
    getById(leaseId: string): ClassifierLease | null;
    list(opts?: {
        classifierSession?: string;
        limit?: number;
    }): ClassifierLease[];
    private getByIdOrThrow;
    private rowToLease;
}
//# sourceMappingURL=classifier-lease-manager.d.ts.map