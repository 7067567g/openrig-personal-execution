// Crash-cart C2 — daemon-DOWN bounded direct-read discovery (plan c015d9ed §C2, arch a1344201).
//
// When the daemon is down (or won't start), the cockpit must still SHOW what is on this host —
// looking is always safe. This module reads the daemon's durable SQLite state WITHOUT a running
// daemon, via COPY-THEN-READ (arch Q1): the daemon DB is WAL-mode, so a post-crash `-wal` holds
// the last committed-but-unreplayed frames (exactly the where-work-stopped rows we must show).
// We copy the {db, -wal, -shm} triple to a disposable scratch dir and open the COPY read-only, so
// SQLite replays the WAL on the copy → a FRESH view with ZERO interference to the originals a
// restarting daemon will reopen. READ-ONLY by construction: nothing here ever writes daemon state.
//
// The read is fail-closed: it REFUSES if a daemon is live (see assertDaemonDown) — never contend
// with the process it exists to recover. All process/IO probes are injected so the logic is
// hermetically unit-testable.
import Database from "better-sqlite3";
import { basename, isAbsolute, join } from "node:path";
import { formatDaemonHostForUrl } from "./daemon-url.js";
/** Refusal: a live daemon holds the DB, so the direct read is unsafe (route to the live read API). */
export class DaemonLiveError extends Error {
    constructor(message) {
        super(message);
        this.name = "DaemonLiveError";
    }
}
/** Loud failure in the direct-read path (e.g. the daemon DB is not where we resolved it). */
export class CrashCartReadError extends Error {
    constructor(message) {
        super(message);
        this.name = "CrashCartReadError";
    }
}
/** The daemon's default DB basename (`$OPENRIG_HOME/openrig.sqlite`) — NOT `main.db`. */
export const DAEMON_DB_BASENAME = "openrig.sqlite";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 7433;
function stripTrailingSlash(u) {
    return u.endsWith("/") ? u.slice(0, -1) : u;
}
/**
 * FAIL-CLOSED guard: throw DaemonLiveError if a daemon is live, else resolve. A daemon counts as
 * live if EITHER the recorded pid is alive OR a /healthz probe answers (both must be negative to
 * proceed). Mirrors the daemon's own liveness logic (daemon.json pid + /healthz, honoring
 * OPENRIG_URL) so the crash-cart never disagrees with `getDaemonStatus` about "is it running".
 */
export async function assertDaemonDown(deps) {
    const { openrigHome, readDaemonJson, isProcessAlive, probeHealthz, openrigUrl } = deps;
    // OPENRIG_URL, when set, is a direct daemon target — probe it first (a live answer = refuse).
    if (openrigUrl && openrigUrl.trim().length > 0) {
        if (await probeHealthz(`${stripTrailingSlash(openrigUrl.trim())}/healthz`)) {
            throw new DaemonLiveError(`a daemon answered OPENRIG_URL ${openrigUrl} — refusing the direct read`);
        }
    }
    const state = readDaemonJson(openrigHome);
    if (state) {
        if (typeof state.pid === "number" && isProcessAlive(state.pid)) {
            throw new DaemonLiveError(`daemon.json pid ${state.pid} is still alive — refusing the direct read`);
        }
        const host = state.host ?? DEFAULT_HOST;
        const port = state.port ?? DEFAULT_PORT;
        const url = `http://${formatDaemonHostForUrl(host)}:${port}/healthz`;
        if (await probeHealthz(url)) {
            throw new DaemonLiveError(`a daemon answered ${url} — refusing the direct read`);
        }
        return;
    }
    // With an explicit target and no local state, an unrelated default daemon
    // does not own this instance. The recorded PID/target guards above still win.
    if (openrigUrl?.trim())
        return;
    // No explicit target or state file: probe the default address.
    if (await probeHealthz(`http://${DEFAULT_HOST}:${DEFAULT_PORT}/healthz`)) {
        throw new DaemonLiveError(`a daemon answered the default http://${DEFAULT_HOST}:${DEFAULT_PORT}/healthz — refusing the direct read`);
    }
}
/**
 * Resolve the daemon DB path. PREFER `daemon.json.db` (the exact path the daemon opened) over
 * recomputing; fall back to `$OPENRIG_HOME/openrig.sqlite`. A relative state-file path is flagged
 * (it resolves against the daemon's CWD, unknown here) rather than silently mis-located.
 */
export function resolveDaemonDbPath(openrigHome, readDaemonJson, configuredDbPath) {
    const state = readDaemonJson(openrigHome);
    if (state?.db && state.db.trim().length > 0) {
        return { path: state.db, fromStateFile: true, relative: !isAbsolute(state.db) };
    }
    const path = configuredDbPath ?? join(openrigHome, DAEMON_DB_BASENAME);
    return { path, fromStateFile: false, relative: !isAbsolute(path) };
}
/**
 * Copy the `{db, -wal, -shm}` triple into `scratchDir` and return the copied db path. The db file is
 * required (loud fail if absent); sidecars are copied only when present (a clean-shutdown DB may have
 * no -wal). The daemon-down precondition (no concurrent writer) is what makes a plain file-copy
 * consistent — opening the COPY then replays the WAL on the copy, never touching the originals.
 */
export function snapshotDaemonDb(dbPath, scratchDir, deps) {
    if (!deps.exists(dbPath)) {
        throw new CrashCartReadError(`daemon DB not found at ${dbPath} — cannot copy-then-read`);
    }
    const destDb = join(scratchDir, basename(dbPath));
    deps.copyFile(dbPath, destDb);
    for (const suffix of ["-wal", "-shm"]) {
        if (deps.exists(dbPath + suffix))
            deps.copyFile(dbPath + suffix, destDb + suffix);
    }
    return destDb;
}
/**
 * Open a COPIED daemon DB read-only. On the copy (in a writable scratch dir with its -wal/-shm
 * alongside) SQLite replays the WAL → the fresh, last-pre-crash view. Read-only is safe here because
 * the copy is disposable and the ORIGINALS are never opened by this path.
 */
export function openDaemonDbReadonly(copyDbPath) {
    return new Database(copyDbPath, { readonly: true, fileMustExist: true });
}
/** Read the full daemon-down discovery view from an already-opened (copied) daemon DB. Read-only. */
export function readCrashCartDiscovery(db) {
    return {
        header: readHeader(db),
        foundOnHost: readFoundOnHost(db),
        whereWorkStopped: readWhereWorkStopped(db),
    };
}
function readHeader(db) {
    const id = db
        .prepare("SELECT host_id, minted_at, reconciled_at FROM self_host_identity WHERE singleton = 1")
        .get();
    // Newest write across the durable tables. datetime() in ORDER BY normalizes the mixed timestamp
    // formats (ISO-Z app writes vs SQLite `datetime('now')` defaults) so the comparison is chronological;
    // we return the ORIGINAL string of that newest row.
    const act = db
        .prepare(`SELECT ts FROM (
         SELECT last_seen_at AS ts FROM sessions
         UNION ALL SELECT created_at FROM sessions
         UNION ALL SELECT created_at FROM events
         UNION ALL SELECT ts_updated FROM queue_items
         UNION ALL SELECT last_seen_at FROM discovered_sessions
         UNION ALL SELECT reconciled_at FROM self_host_identity WHERE singleton = 1
       ) WHERE ts IS NOT NULL ORDER BY datetime(ts) DESC LIMIT 1`)
        .get();
    return {
        lastActivityAt: act?.ts ?? null,
        lastBootAt: id?.reconciled_at ?? null,
        firstBootAt: id?.minted_at ?? null,
        hostId: id?.host_id ?? null,
        stopReason: null,
        priorUptimeMs: null,
    };
}
function readFoundOnHost(db) {
    // Per rig: seat count + counts folded over the LATEST session per node (max ULID id, per the
    // daemon's own latest-per-node convention) + newest persisted last_seen_at.
    const rows = db
        .prepare(`SELECT r.id AS rigId, r.name AS rigName,
         (SELECT COUNT(*) FROM nodes n WHERE n.rig_id = r.id) AS seatCount,
         (SELECT COUNT(*) FROM nodes n WHERE n.rig_id = r.id
            AND (SELECT s.status FROM sessions s WHERE s.node_id = n.id ORDER BY s.id DESC LIMIT 1) = 'running'
         ) AS runningCount,
         (SELECT COUNT(*) FROM nodes n WHERE n.rig_id = r.id
            AND (SELECT s.resume_last_probe_status FROM sessions s WHERE s.node_id = n.id ORDER BY s.id DESC LIMIT 1) = 'resumable'
         ) AS resumableCount,
         (SELECT MAX(s.last_seen_at) FROM sessions s JOIN nodes n ON s.node_id = n.id WHERE n.rig_id = r.id) AS lastActiveAt
       FROM rigs r
       WHERE r.archived_at IS NULL
       ORDER BY r.name ASC`)
        .all();
    return rows.map((r) => ({
        rigId: r.rigId,
        rigName: r.rigName,
        seatCount: r.seatCount,
        runningCount: r.runningCount,
        resumableCount: r.resumableCount,
        lastActiveAt: r.lastActiveAt ?? null,
    }));
}
/**
 * The public C2 entry: safely read the daemon-down discovery view. FAIL-CLOSED FIRST (throws
 * DaemonLiveError before touching disk if a daemon is live), then copy-then-read the DB into a
 * disposable scratch dir, read the view, and ALWAYS clean up the scratch copy. Read-only end to end.
 */
export async function loadCrashCartDiscovery(deps) {
    // Refuse before any disk work if a daemon holds the DB.
    await assertDaemonDown(deps);
    const resolved = resolveDaemonDbPath(deps.openrigHome, deps.readDaemonJson, deps.configuredDbPath);
    if (resolved.relative) {
        throw new CrashCartReadError(`daemon DB path '${resolved.path}' is relative — the daemon CWD is unknown, cannot locate it daemon-down`);
    }
    if (!resolved.fromStateFile && !deps.exists(resolved.path)) {
        return { dbPath: resolved, discovery: {
                header: { lastActivityAt: null, lastBootAt: null, firstBootAt: null, hostId: null, stopReason: null, priorUptimeMs: null },
                foundOnHost: [], whereWorkStopped: [],
            } };
    }
    const scratchDir = deps.makeScratchDir();
    try {
        const copyDb = snapshotDaemonDb(resolved.path, scratchDir, {
            copyFile: deps.copyFile,
            exists: deps.exists,
        });
        const db = (deps.openDb ?? openDaemonDbReadonly)(copyDb);
        try {
            return { discovery: readCrashCartDiscovery(db), dbPath: resolved };
        }
        finally {
            db.close();
        }
    }
    finally {
        deps.removeScratchDir(scratchDir);
    }
}
function readWhereWorkStopped(db) {
    const rows = db
        .prepare(`SELECT qitem_id AS qitemId, destination_session AS destinationSession, source_session AS sourceSession,
              state, claimed_at AS claimedAt, summary, ts_updated AS tsUpdated
       FROM queue_items
       WHERE state = 'in-progress'
       ORDER BY datetime(ts_updated) DESC, qitem_id DESC`)
        .all();
    return rows.map((r) => ({
        qitemId: r.qitemId,
        destinationSession: r.destinationSession,
        sourceSession: r.sourceSession,
        state: r.state,
        claimedAt: r.claimedAt ?? null,
        summary: r.summary ?? null,
        tsUpdated: r.tsUpdated,
    }));
}
//# sourceMappingURL=crash-cart-discovery.js.map