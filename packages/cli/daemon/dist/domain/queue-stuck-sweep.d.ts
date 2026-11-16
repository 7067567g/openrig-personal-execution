import type Database from "better-sqlite3";
import { type QueueRepository } from "./queue-repository.js";
export declare const STUCK_SWEEP_INTERVAL_KEY = "queue.stuck_sweep_interval_seconds";
export declare const DEFAULT_STUCK_SWEEP_INTERVAL_SECONDS = 300;
export declare const STUCK_SWEEP_UNCLAIMED_AGE_KEY = "queue.stuck_sweep_unclaimed_age_minutes";
export declare const DEFAULT_STUCK_SWEEP_UNCLAIMED_AGE_MINUTES = 60;
export declare const STUCK_SWEEP_CUSTODY_WINDOW_HOURS = 24;
/** Stamp tag on every routed finding row: the sweep's self-exclusion mark. */
export declare const STUCK_SWEEP_FINDING_TAG = "stuck-sweep-finding";
export declare const LADDER_ATTEMPT_PREFIX = "wake-attempt:";
export declare const LADDER_RUNG_PREFIX = "escalation-rung:";
export declare const LADDER_EXHAUSTED_PREFIX = "ladder-exhausted:";
export type StuckFindingKind = "unconsumed-wait" | "overdue-claim" | "stalled-after-claim" | "undelivered-wake" | "unclaimed-obligation" | "dangling-closure";
/** Idempotency key: one open finding row per (stuck row, finding kind). */
export declare function findingDedupTag(kind: StuckFindingKind, qitemId: string): string;
export interface StuckSweepStatusSnapshot {
    lastSweepAt: string | null;
    lastOutcome: "clean" | "findings" | "failed" | null;
    lastError: string | null;
    consecutiveFailures: number;
    findingsRouted: number;
}
export interface StuckSweepStatus {
    record(outcome: "clean" | "findings" | "failed", detail?: {
        error?: string;
        findings?: number;
    }): void;
    snapshot(): StuckSweepStatusSnapshot;
}
/** The loop's observable heartbeat — surfaced on /healthz so a quiet sweep is cheap but
 *  never invisible, and a failing sweep is loud without needing a row. */
export declare function createStuckSweepStatus(): StuckSweepStatus;
/** Cadence, fresh-read with fail-open defaults (the queue-pickup precedent: a config flip
 *  applies to the next tick, and a settings error never silences the sweep). */
export declare function resolveStuckSweepIntervalSeconds(): number;
export declare function resolveStuckSweepUnclaimedAgeMinutes(): number;
export interface StuckSweepDeps {
    db: Database.Database;
    queueRepo: QueueRepository;
    status?: StuckSweepStatus;
    /** Route resolution for obligations nobody holds: the destination seat's orchestrator
     *  (delegates_to parentage). null = no orchestrator known → the finding stays with the
     *  destination (the row is durable there even if the seat is dead — S01 is the wake
     *  layer). Injectable for tests; default derives from topology. */
    resolveOrchestrator?: (session: string) => string | null;
    unclaimedAgeMinutes?: number;
    custodyWindowHours?: number;
    now?: Date;
    log?: (line: string) => void;
    /** Is this host id (or observed self-id) present in the operator's hosts registry?
     *  One of TWO conjunct conditions for the proof-at-write disposition — the other is
     *  that the successor id recomputes through `deriveCrossHostSuccessorId` from the
     *  row's own fields, because the cross-host close (routes/queue.ts) creates the
     *  successor on that host FIRST and records the derived `<id>@<host>` only after that
     *  create succeeded, while the generic update path can store any string. Registry
     *  membership alone never suppresses. Injectable for tests; default reads the local
     *  hosts.yaml once per sweep pass, and an unavailable registry degrades honestly to
     *  verification-required (more indeterminate findings, never a false verdict). */
    isRegisteredHost?: (hostId: string) => boolean;
}
export interface StuckSweepFindingAction {
    kind: StuckFindingKind;
    qitemId: string;
    findingQitemId: string;
    action: "created" | "refreshed" | "closed";
}
export interface StuckSweepResult {
    outcome: "clean" | "findings" | "failed";
    findings: StuckSweepFindingAction[];
    error?: string;
}
export { resolveSessionNodeId, defaultResolveOrchestrator } from "./queue-owner.js";
/** The latest ladder marker is authoritative: a retry after exhaustion makes the
 *  ladder live again. Unrelated transitions do not change the latest marker. */
/** Durable custody-verification disposition: a transition note on the CLOSED source row,
 *  written by whoever performed the registered-host read (never by this detector),
 *  `custody-verified: <exact-target> <free-form how/where>`. Prefix-anchored parse; the
 *  target is the first whitespace-delimited token after the prefix, matched exactly.
 *  Read from the ACTIVE table AND the retention archive: the daily archiver MOVES every
 *  transition of an aged terminal qitem into `queue_transitions_archive` (the exact class
 *  custody rows belong to) while the row itself keeps participating in this sweep, so an
 *  active-only read would forget the disposition after the retention window and re-mint
 *  the very finding the verifier already answered. The archive is never deleted, so the
 *  union is the complete audit history. */
export declare const CUSTODY_VERIFIED_PREFIX = "custody-verified:";
export declare function verificationCommand(target: string): string;
/**
 * One sweep pass. Instance-wide (no rig scope — the loop is the net for every rig the
 * daemon carries). Never throws: a sweep that cannot run reports outcome=failed loudly
 * on the status surface and the log, because a silent skip is exactly the class this
 * slice exists to kill.
 */
export declare function runStuckSweep(deps: StuckSweepDeps): Promise<StuckSweepResult>;
//# sourceMappingURL=queue-stuck-sweep.d.ts.map