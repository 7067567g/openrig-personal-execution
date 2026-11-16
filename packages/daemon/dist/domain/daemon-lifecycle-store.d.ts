import type Database from "better-sqlite3";
/** The daemon's lifecycle record (mig-061 singleton) — started / last-seen /
 *  stopped for the current boot epoch. Distinct from the identity record (059). */
export interface DaemonLifecycleRecord {
    bootEpoch: string;
    startedAt: string;
    lastHeartbeatAt: string | null;
    stoppedAt: string | null;
}
/**
 * P7 — accessors for the daemon_lifecycle singleton. Each write is a single
 * statement = its own implicit SQLite transaction (arch: "own tiny transaction").
 * The heartbeat guards not-stopped and the stop is terminal-per-epoch, so a stray
 * post-stop tick can never advance last-seen (the binding write-order pin).
 */
export declare class DaemonLifecycleStore {
    private readonly db;
    constructor(db: Database.Database);
    /** A new boot: mint a new epoch, set started_at, and CLEAR the prior run's
     *  heartbeat + stopped_at (a fresh epoch never shows the previous run's stop). */
    recordBoot(bootEpoch: string, nowIso: string): void;
    /** Advance last-seen — ONLY while not stopped (a stray tick after stopped_at
     *  must never move last-seen; stopped_at is terminal per epoch). */
    recordHeartbeat(nowIso: string): void;
    /** Clean-shutdown mark — set stopped_at ONLY for the matching epoch and only if
     *  not already stopped (terminal per epoch). */
    recordStop(bootEpoch: string, nowIso: string): void;
    get(): DaemonLifecycleRecord | null;
}
//# sourceMappingURL=daemon-lifecycle-store.d.ts.map