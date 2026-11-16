import type Database from "better-sqlite3";
export type ParkWakeKind = "watchdog" | "timer" | "blocker";
export type ParkWakePhase = "armed" | "fired";
/** S16: identifies the one shared provider/account blocker whose own timer expiry
 *  is inherited by its dependent HELD rows. Ordinary blockers remain expiry-less. */
export declare const USAGE_LIMIT_BLOCKER_TAG = "usage-limit-blocker";
export declare const USAGE_LIMIT_POOL_TAG_PREFIX = "usage-limit-pool:";
/** One arithmetic for the S16 timer's projected due boundary. The scheduler
 *  enforces the same boundary after the attach leg seeds lastEvaluationAt to
 *  registeredAt. */
export declare function timerExpiresAt(registeredAt: string, intervalSeconds: number): string | undefined;
export interface QueueWakeRecord {
    transitionId: number;
    qitemId: string;
    phase: ParkWakePhase;
    kind: ParkWakeKind;
    ref: string;
    deliveryStatus: string | null;
    expiresAt?: string;
}
export interface ParkWakeStatus {
    kind: ParkWakeKind;
    ref: string;
    phase: ParkWakePhase;
    live: boolean;
    deliveryStatus: string | null;
    /** A wake fired, but the row is still HELD. The resume attempt is visible
     *  and cannot be mistaken for a healthy armed continuation. */
    unconsumed: boolean;
    /** Repeating wait notices have a separate bounded recovery owner. */
    recoveryOwner?: "queue-stuck-sweep";
    /** Absolute due time derived from canonical watchdog metadata. Present only
     *  for a timer or a dependent of the sanctioned usage-limit timer blocker. */
    expiresAt?: string;
}
/** Persistence + live-state projection for transition-bound park wakes. */
export declare class QueueWakeRepository {
    private readonly db;
    private readonly available;
    constructor(db: Database.Database);
    record(input: QueueWakeRecord): void;
    getForTransition(transitionId: number): QueueWakeRecord | null;
    getStatus(qitemId: string): ParkWakeStatus | null;
    /** A blocked row whose current wake is an attached, active `periodic-reminder` aimed at the row's own owner, which
     *  has fired since this park and whose latest delivery reached that owner. Its owner is being woken by that reminder
     *  on its cadence, so parked diagnosis needn't count the row as stranded. Read only from existing records; anything
     *  it can't establish (no fire yet, a failed or retained attempt, a refused or skipped latest evaluation, a stopped
     *  job, another target, a one-shot park timer, a blocker, missing history) answers false, leaving today's result. */
    servedByOwnRepeatingReminder(qitemId: string): boolean;
    findBlockedQitemsByWatchdog(jobId: string, latestArmedOnly?: boolean): Array<{
        qitemId: string;
        kind: "watchdog" | "timer";
    }>;
    /** Queue rows bound to a park-generated timer, regardless of whether that
     *  timer has fired before. Legacy daemons could leave a repeating timer live
     *  after its row closed, so delivery-time defense must consult the original
     *  armed binding rather than only the current blocked/fired projection. */
    findQitemsByGeneratedTimer(jobId: string): Array<{
        qitemId: string;
        state: string;
    }>;
    /** A current attachment keeps a shared generated job alive until consumed.
     *  A retained attempt never consumes it; a failed one does, except on a repeating timer, which retries. */
    findLiveQitemsByAttachedWatchdog(jobId: string): Array<{
        qitemId: string;
        state: string;
    }>;
    /** The generating row retains timer lifecycle only while its current park
     *  uses this job, including an explicit reattachment to the same job. */
    findCurrentQitemsByGeneratedTimer(jobId: string): Array<{
        qitemId: string;
        state: string;
    }>;
    /** Active park-generated timers that are still their blocked row's current wake and still target the
     *  row's owner. These wake the seat that owns the row, not a particular occupant, so a seat swap keeps
     *  them; any other job the retiring occupant registered still stops. */
    currentParkTimerIds(): string[];
    private isLive;
    private isRepeatingTimer;
    private isUsageLimitBlocker;
    private wakeExpiry;
    private usageLimitBlockerExpiry;
    private timerExpiry;
    private row;
}
//# sourceMappingURL=queue-wake-repository.d.ts.map