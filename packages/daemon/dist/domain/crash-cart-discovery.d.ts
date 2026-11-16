import Database from "better-sqlite3";
/** Refusal: a live daemon holds the DB, so the direct read is unsafe (route to the live read API). */
export declare class DaemonLiveError extends Error {
    constructor(message: string);
}
/** Loud failure in the direct-read path (e.g. the daemon DB is not where we resolved it). */
export declare class CrashCartReadError extends Error {
    constructor(message: string);
}
/** The daemon's default DB basename (`$OPENRIG_HOME/openrig.sqlite`) — NOT `main.db`. */
export declare const DAEMON_DB_BASENAME = "openrig.sqlite";
/** The daemon state file shape (`$OPENRIG_HOME/daemon.json`) — the authoritative DB-path + liveness record. */
export interface DaemonJson {
    pid: number;
    port: number;
    host?: string;
    /** The exact resolved DB path the daemon opened (prefer this over recomputing). */
    db: string;
    startedAt?: string;
}
export interface AssertDaemonDownDeps {
    /** `$OPENRIG_HOME` — where daemon.json lives. */
    openrigHome: string;
    /** Parse `$OPENRIG_HOME/daemon.json` → the record, or undefined if absent/unparseable (treated as down). */
    readDaemonJson: (openrigHome: string) => DaemonJson | undefined;
    /** True if `pid` is a live process (e.g. `process.kill(pid, 0)` succeeds). */
    isProcessAlive: (pid: number) => boolean;
    /** GET `<url>` → true if ANY daemon answered (the control-plane is live). Never throws. */
    probeHealthz: (url: string) => Promise<boolean>;
    /** `OPENRIG_URL` override — when set, its /healthz is probed too (bypasses the state file, like getDaemonStatus). */
    openrigUrl?: string;
}
/**
 * FAIL-CLOSED guard: throw DaemonLiveError if a daemon is live, else resolve. A daemon counts as
 * live if EITHER the recorded pid is alive OR a /healthz probe answers (both must be negative to
 * proceed). Mirrors the daemon's own liveness logic (daemon.json pid + /healthz, honoring
 * OPENRIG_URL) so the crash-cart never disagrees with `getDaemonStatus` about "is it running".
 */
export declare function assertDaemonDown(deps: AssertDaemonDownDeps): Promise<void>;
/** The resolved daemon DB location + provenance. `relative` flags a state-file path we cannot
 *  reliably locate (the daemon's CWD is unknown to a separate reader) — the caller must handle it. */
export interface ResolvedDbPath {
    path: string;
    fromStateFile: boolean;
    relative: boolean;
}
/**
 * Resolve the daemon DB path. PREFER `daemon.json.db` (the exact path the daemon opened) over
 * recomputing; fall back to `$OPENRIG_HOME/openrig.sqlite`. A relative state-file path is flagged
 * (it resolves against the daemon's CWD, unknown here) rather than silently mis-located.
 */
export declare function resolveDaemonDbPath(openrigHome: string, readDaemonJson: (openrigHome: string) => DaemonJson | undefined, configuredDbPath?: string): ResolvedDbPath;
export interface SnapshotDeps {
    /** Copy one file (e.g. `copyFileSync`). */
    copyFile: (src: string, dest: string) => void;
    /** True if the path exists (e.g. `existsSync`). */
    exists: (p: string) => boolean;
}
/**
 * Copy the `{db, -wal, -shm}` triple into `scratchDir` and return the copied db path. The db file is
 * required (loud fail if absent); sidecars are copied only when present (a clean-shutdown DB may have
 * no -wal). The daemon-down precondition (no concurrent writer) is what makes a plain file-copy
 * consistent — opening the COPY then replays the WAL on the copy, never touching the originals.
 */
export declare function snapshotDaemonDb(dbPath: string, scratchDir: string, deps: SnapshotDeps): string;
/**
 * Open a COPIED daemon DB read-only. On the copy (in a writable scratch dir with its -wal/-shm
 * alongside) SQLite replays the WAL → the fresh, last-pre-crash view. Read-only is safe here because
 * the copy is disposable and the ORIGINALS are never opened by this path.
 */
export declare function openDaemonDbReadonly(copyDbPath: string): Database.Database;
/** Header facts. `stopReason`/`priorUptimeMs` are ALWAYS null: no shutdown/uptime record is persisted
 *  anywhere (verified at source), so they are honest-null daemon-down — never fabricated. */
export interface CrashCartHeader {
    /** Newest write-timestamp across the durable tables (best-effort "last activity"); null if empty. */
    lastActivityAt: string | null;
    /** Last daemon boot (self_host_identity.reconciled_at advances every boot); null if never booted. */
    lastBootAt: string | null;
    /** First-ever boot (self_host_identity.minted_at). */
    firstBootAt: string | null;
    hostId: string | null;
    /** UNRECOVERABLE daemon-down — no shutdown record exists. Honest-null. */
    stopReason: null;
    /** UNRECOVERABLE daemon-down — no persisted uptime. Honest-null. */
    priorUptimeMs: null;
}
/** One rig found on this host, with the recovery-relevant counts. */
export interface RigFound {
    rigId: string;
    rigName: string;
    seatCount: number;
    runningCount: number;
    /** Seats whose LATEST session was probed resumable (derived; the recoverable bucket). */
    resumableCount: number;
    /** Newest persisted `sessions.last_seen_at` for the rig; null if none. (Live "last active" is a
     *  tmux observation, unavailable daemon-down — this is the honest DB approximation.) */
    lastActiveAt: string | null;
}
/** One in-progress queue item at crash time (display-only; the cart never mutates queue state). */
export interface StoppedWork {
    qitemId: string;
    destinationSession: string;
    sourceSession: string;
    state: string;
    claimedAt: string | null;
    summary: string | null;
    tsUpdated: string;
}
export interface CrashCartDiscovery {
    header: CrashCartHeader;
    foundOnHost: RigFound[];
    whereWorkStopped: StoppedWork[];
}
/** Read the full daemon-down discovery view from an already-opened (copied) daemon DB. Read-only. */
export declare function readCrashCartDiscovery(db: Database.Database): CrashCartDiscovery;
export interface LoadCrashCartDiscoveryDeps extends AssertDaemonDownDeps {
    /** Current CLI configuration, used only when no daemon has recorded its opened DB. */
    configuredDbPath?: string;
    /** Copy one file (e.g. `copyFileSync`). */
    copyFile: (src: string, dest: string) => void;
    /** True if the path exists (e.g. `existsSync`). */
    exists: (p: string) => boolean;
    /** Create a fresh disposable scratch dir for the DB copy; returns its path. */
    makeScratchDir: () => string;
    /** Remove the scratch dir (best-effort cleanup). */
    removeScratchDir: (dir: string) => void;
    /** Open the copied DB read-only. Defaults to openDaemonDbReadonly; injected in tests. */
    openDb?: (copyDbPath: string) => Database.Database;
}
/**
 * The public C2 entry: safely read the daemon-down discovery view. FAIL-CLOSED FIRST (throws
 * DaemonLiveError before touching disk if a daemon is live), then copy-then-read the DB into a
 * disposable scratch dir, read the view, and ALWAYS clean up the scratch copy. Read-only end to end.
 */
export declare function loadCrashCartDiscovery(deps: LoadCrashCartDiscoveryDeps): Promise<{
    discovery: CrashCartDiscovery;
    dbPath: ResolvedDbPath;
}>;
//# sourceMappingURL=crash-cart-discovery.d.ts.map