import type Database from "better-sqlite3";
import type { ClassifierLeaseManager } from "./classifier-lease-manager.js";
/**
 * Classification attempt ledger (0.6.0 S02 P1).
 *
 * Holds everything a classifier occupant must remember that does NOT belong in
 * the immutable `project_classifications` row: in-flight work, abstentions and
 * errors. It is a ledger, not a scheduler — the occupant is woken by the
 * existing watchdog/wake cadence and asks `eligible()` what to do next.
 *
 * Identity: (stream_item_id, classifier_version, taxonomy_version, evidence_epoch).
 * - abstained: terminal for that identity only. A new classifier/taxonomy
 *   version or an owner-authorized evidence epoch is a new identity.
 * - error / abandoned in_flight: retried after a bounded, doubling delay until
 *   the retry budget is spent, then `exhausted` (terminal, visible).
 * - written: set by ProjectClassifier in the same transaction as the row.
 *
 * Every state change validates the lease (active, same session, same lease id,
 * not expired) inside its write transaction.
 *
 * Execution fence: each begin — first try, timeout reissue or error retry —
 * mints a new executionId. abstain / fail / the classify attempt binding must
 * present the CURRENT executionId; an older execution is refused
 * (`attempt_superseded`) without touching the current one. A lease can be
 * renewed indefinitely, so lease validity never proves an older execution is
 * dead; only the fence does.
 */
export declare const ATTEMPT_STATUSES: readonly ["in_flight", "abstained", "written", "error", "exhausted"];
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];
/**
 * Retry defaults, chosen against the existing cadence rather than a new
 * scheduler:
 * - budget 3 attempts per identity: one try plus two retries is enough to ride
 *   out a transient provider or daemon blip without looping on a poison item;
 * - backoff 5 min, doubling, capped at 60 min: coarser than the occupant's own
 *   wake so a failing item never spins, and bounded so a recovered provider is
 *   retried within the hour;
 * - in-flight timeout 15 min: after this long without a finish, the attempt
 *   may be reissued as a new execution (a crash is the common cause). This is
 *   NOT proof the older execution is dead — leases are renewable — which is why
 *   the reissue mints a new executionId and the old one can no longer finish.
 *   Reissues count against the budget.
 * All are constructor options; tests inject time instead of sleeping.
 */
export declare const DEFAULT_RETRY_BUDGET = 3;
export declare const DEFAULT_BASE_BACKOFF_MS: number;
export declare const DEFAULT_MAX_BACKOFF_MS: number;
export declare const DEFAULT_IN_FLIGHT_TIMEOUT_MS: number;
export declare const MAX_ELIGIBLE_PAGE = 100;
export interface AttemptIdentity {
    streamItemId: string;
    classifierVersion: string;
    taxonomyVersion: string;
    /** Owner-authorized retry epoch bound to changed evidence; "0" when unused. */
    evidenceEpoch: string;
}
export interface ClassificationAttempt extends AttemptIdentity {
    attemptId: string;
    /** Current execution; only this value may finish the attempt. */
    executionId: string;
    status: AttemptStatus;
    attemptCount: number;
    leaseId: string;
    classifierSession: string;
    retryAfter: string | null;
    reason: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface EligibleItem {
    streamItemId: string;
    tsEmitted: string;
    streamSortKey: string;
    sourceSession: string;
}
export interface EligiblePage {
    items: EligibleItem[];
    /** Pass as `afterSortKey` to read the next page of THIS pass; null when done. */
    nextAfterSortKey: string | null;
}
export declare class ClassificationAttemptError extends Error {
    readonly code: string;
    readonly meta: Record<string, unknown> | undefined;
    constructor(code: string, message: string, meta?: Record<string, unknown>);
}
export interface ClassificationAttemptLedgerOptions {
    now?: () => Date;
    retryBudget?: number;
    baseBackoffMs?: number;
    maxBackoffMs?: number;
    inFlightTimeoutMs?: number;
}
export declare class ClassificationAttemptLedger {
    readonly db: Database.Database;
    private readonly leaseManager;
    private readonly now;
    private readonly retryBudget;
    private readonly baseBackoffMs;
    private readonly maxBackoffMs;
    private readonly inFlightTimeoutMs;
    constructor(db: Database.Database, leaseManager: ClassifierLeaseManager, opts?: ClassificationAttemptLedgerOptions);
    /**
     * Start (or legitimately resume) an attempt for one identity under the
     * caller's lease. Refuses terminal identities, fresh in-flight attempts and
     * errors that are not yet due. An in-flight attempt older than the in-flight
     * timeout, or owned by a replaced lease, counts as an abandoned crash.
     */
    begin(input: AttemptIdentity & {
        leaseId: string;
        classifierSession: string;
    }): ClassificationAttempt;
    /** Terminal abstention for this identity (below threshold / INDETERMINATE). */
    abstain(input: FinishInput): ClassificationAttempt;
    /** Transient failure: schedule a bounded retry, or exhaust the budget. */
    fail(input: FinishInput): ClassificationAttempt;
    /**
     * One bounded page of items the occupant may attempt now for the given
     * versions and epoch, in stream order. Derived by anti-join every call, so a
     * later-due retry reappears on the next pass without any stored cursor
     * skipping it. `afterSortKey` pages within a single pass only.
     */
    eligible(opts: {
        classifierVersion: string;
        taxonomyVersion: string;
        evidenceEpoch: string;
        limit?: number;
        afterSortKey?: string;
    }): EligiblePage;
    getById(attemptId: string): ClassificationAttempt | null;
    private finish;
    private backoffMs;
    private findRow;
    private getByIdOrThrow;
}
export interface FinishInput {
    attemptId: string;
    /** The executionId returned by the begin() that started THIS execution. */
    executionId: string;
    leaseId: string;
    classifierSession: string;
    reason: string;
}
//# sourceMappingURL=classification-attempts.d.ts.map