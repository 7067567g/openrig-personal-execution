/** The daemon's lifecycle record (mig-061), read CLI-side for the status render. */
export interface DaemonLifecycleRecord {
    bootEpoch: string;
    startedAt: string;
    lastHeartbeatAt: string | null;
    stoppedAt: string | null;
}
export interface LifecycleDescription {
    /** clean-shutdown = stopped_at was written; no-clean-shutdown = it wasn't (crash/
     *  kill-9/power-loss); unknown = no record at all (pre-P7 daemon or never booted). */
    kind: "clean-shutdown" | "no-clean-shutdown" | "unknown";
    /** best last-seen: stopped_at if clean, else last heartbeat, else boot time. */
    lastSeen: string | null;
    stoppedAt: string | null;
}
/**
 * P7 render classification — pure. A stopped_at means the daemon marked a clean
 * shutdown; its ABSENCE (with a boot record present) is the money case: the daemon
 * died without recording a clean stop, so we render "no clean shutdown recorded,
 * last-seen T" instead of a bare "not running".
 */
export declare function describeLifecycle(record: DaemonLifecycleRecord | null): LifecycleDescription;
/**
 * Read the daemon_lifecycle singleton directly from the daemon's SQLite db,
 * READ-ONLY. This is the crash-surviving read path: on a dead pid the daemon
 * isn't answering HTTP and daemon.json is deleted, but the SQLite row persists.
 * Returns null if the db/table is absent or unreadable (→ "unknown").
 */
/** The daemon's db path, resolved the SAME way the daemon resolves it (D15):
 *  explicit OPENRIG_DB/RIGGED_DB wins, else OPENRIG_HOME/openrig.sqlite. Never
 *  CWD-relative. */
export declare function resolveLifecycleDbPath(): string;
/** Read + classify the lifecycle record from the resolved db path (crash-surviving). */
export declare function readLifecycleDescription(): LifecycleDescription;
export declare function readDaemonLifecycle(dbPath: string): DaemonLifecycleRecord | null;
//# sourceMappingURL=daemon-lifecycle-status.d.ts.map