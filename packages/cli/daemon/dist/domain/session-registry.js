import { monotonicFactory } from "ulid";
import { randomUUID } from "node:crypto";
const ulid = monotonicFactory();
import { validateSessionName } from "./session-name.js";
import { formatWatchdogRegistrationError } from "./watchdog-auto-registration.js";
/** A token write that changes the value invalidates what was known about how the old one began. */
const CLEAR_ROTATION_ON_TOKEN_CHANGE = "resume_rotated_from = CASE WHEN resume_token IS ? THEN resume_rotated_from ELSE NULL END, " +
    "resume_rotated_process = CASE WHEN resume_token IS ? THEN resume_rotated_process ELSE NULL END";
/** The columns `claudeResumeRotation` reads. */
export const CLAUDE_RESUME_ROTATION_COLUMNS = "resume_token, resume_provenance, resume_rotated_from, resume_rotated_process, resume_launch_process";
function launchedProcess(json) {
    try {
        const process = JSON.parse(json ?? "null");
        return process && Number.isInteger(process.pid) && typeof process.startedAt === "string" && process.startedAt
            ? { pid: process.pid, startedAt: process.startedAt, token: process.token } : null;
    }
    catch {
        return null;
    }
}
/** The rotation a Claude identity proof may accept besides the stored token (#1077): the token
 *  OpenRig launched this row's process to resume, when the first hook after that launch, sent by
 *  that process, said Claude continued it as the stored token; and that process, the only one whose
 *  argv may name it. The hook's process must be the one the launch path itself observed starting on
 *  that token (`resume_launch_process`): a process that replaced it before its hook arrived is not.
 *  Null unless the stored token is still that hook's own record. Callers pass it as `rotation`. */
export function claudeResumeRotation(row) {
    if (!row || row.resume_provenance !== "hook")
        return null;
    const from = row.resume_rotated_from?.trim();
    if (!from || from === row.resume_token?.trim())
        return null;
    const hooked = launchedProcess(row.resume_rotated_process);
    const launch = launchedProcess(row.resume_launch_process);
    if (!hooked || !launch || launch.token !== from || launch.pid !== hooked.pid || launch.startedAt !== hooked.startedAt)
        return null;
    return { token: from, process: { pid: hooked.pid, startedAt: hooked.startedAt } };
}
/** Resume-token provenance precedence (OPR.0.4.0.22; adoption rung added by
 *  OPR.0.4.3.20 FR-3). Higher rank wins; a lower-rank write never overwrites a
 *  higher-rank persisted token.
 *  operator/attested (deliberate set) > hook (runtime self-report) >
 *  adoption (captured at the reconcile/adopt/bind boundary) > scrape (pane).
 *  adoption sits BELOW hook deliberately: a live runtime hook self-report is
 *  fresher than an adoption-time snapshot, so hook must be able to refresh an
 *  adoption token (FR-3 §2.4 — do not freeze the token at adoption time and
 *  reintroduce the staleness the survive slice exists to kill). */
export const RESUME_PROVENANCE_RANK = {
    scrape: 0,
    adoption: 1,
    hook: 2,
    operator: 3,
};
export class SessionRegistry {
    db;
    watchdogRegistrationObserver;
    constructor(db, watchdogRegistrationObserver) {
        this.db = db;
        this.watchdogRegistrationObserver = watchdogRegistrationObserver;
    }
    setWatchdogRegistrationObserver(observer) {
        this.watchdogRegistrationObserver = observer;
    }
    registerSession(nodeId, sessionName, kind = "initial", reservedGeneration) {
        if (!validateSessionName(sessionName)) {
            throw new Error(`Invalid session name "${sessionName}": must match legacy r{NN}-{suffix} or canonical {pod}-{member}@{rig} format with allowed characters (a-z, A-Z, 0-9, -, _, ., @)`);
        }
        const id = ulid();
        this.db
            .prepare("INSERT INTO sessions (id, node_id, session_name) VALUES (?, ?, ?)")
            .run(id, nodeId, sessionName);
        this.mintOccupantTenureBestEffort(nodeId, kind, reservedGeneration); // atom-B: mint this occupant generation
        this.observeWatchdogRegistration(nodeId, sessionName, kind);
        return this.rowToSession(this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id));
    }
    /** Register a claimed session — skips naming validation, sets origin='claimed', startup_status='ready'. */
    registerClaimedSession(nodeId, sessionName, kind = "adopt", reservedGeneration) {
        const id = ulid();
        this.db
            .prepare("INSERT INTO sessions (id, node_id, session_name, status, origin, startup_status) VALUES (?, ?, ?, 'running', 'claimed', 'ready')")
            .run(id, nodeId, sessionName);
        this.mintOccupantTenureBestEffort(nodeId, kind, reservedGeneration); // atom-B: mint this occupant generation
        this.observeWatchdogRegistration(nodeId, sessionName, kind);
        return this.rowToSession(this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id));
    }
    /**
     * atom-B — mint (or CONTINUE) the occupant-generation tenure for a node. RELAUNCH is a CONTINUATION:
     * if the same native session id is already recorded for this node, return the existing tenure WITHOUT
     * minting a new generation. A new occupant (initial/handover/adopt, or a new/unknown native session)
     * mints the next generation_ordinal with a fresh generation_uuid. Append-only — the ledger is never
     * mutated. (Relaunch also naturally continues by NOT re-calling the register verbs; the native-session
     * dedup here is the safety net for a re-register.)
     */
    /** atom-B — mint the occupant tenure at a register verb, but FAIL-ISOLATED: a session registration
     *  (a core operation) must NOT die because the additive occupant-generation ledger write failed
     *  (e.g. a db that has not run migration 060). On failure we LOG loudly (once per process — a
     *  missing ledger table in production is a visible defect) and let the register succeed;
     *  generation-scoped consumers degrade to loud-pending, never a silent-wrong. Direct callers that
     *  REQUIRE the tenure use `mintOccupantTenure` (which throws). */
    mintOccupantTenureBestEffort(nodeId, kind, reservedGeneration) {
        try {
            this.mintOccupantTenure(nodeId, kind, null, reservedGeneration);
        }
        catch (e) {
            if (!SessionRegistry.tenureMintWarned) {
                SessionRegistry.tenureMintWarned = true;
                // Attributable (node_id + kind/verb) so a failed mint is traceable from logs (orch note 1);
                // once-per-process to avoid spamming a stale-migration db, but the FIRST failure pins the node.
                console.warn(`[session-registry] occupant-tenure mint FAILED for node_id="${nodeId}" (kind=${kind}): ${e.message} — ` +
                    `registration proceeds, but generation-scoped ghost-stage protection is UNAVAILABLE for this node. ` +
                    `Ensure migration 060_occupant_tenures ran. (Further mint failures suppressed this process.)`);
            }
        }
    }
    static tenureMintWarned = false;
    observeWatchdogRegistration(nodeId, sessionName, kind) {
        const observer = this.watchdogRegistrationObserver;
        if (!observer)
            return;
        if (observer.isEligibleSessionName?.(sessionName) === false) {
            if (kind === "handover" && observer.reconcileHandover) {
                this.runWatchdogEnsure(nodeId, sessionName, () => observer.reconcileHandover(nodeId, sessionName));
            }
            return;
        }
        this.runWatchdogEnsure(nodeId, sessionName, () => observer.ensure(nodeId, sessionName));
        try {
            observer.assertCoverage(nodeId, sessionName);
        }
        catch (error) {
            console.warn(`[session-registry] watchdog coverage FAILED for node_id="${nodeId}" ` +
                `session="${sessionName}": ${formatWatchdogRegistrationError(error)}`);
        }
    }
    runWatchdogEnsure(nodeId, sessionName, ensure) {
        try {
            ensure();
        }
        catch (error) {
            if (!SessionRegistry.watchdogEnsureWarned) {
                SessionRegistry.watchdogEnsureWarned = true;
                console.warn(`[session-registry] watchdog auto-registration FAILED for node_id="${nodeId}" ` +
                    `session="${sessionName}": ${formatWatchdogRegistrationError(error)} ` +
                    `(further ensure failures suppressed this process)`);
            }
        }
    }
    static watchdogEnsureWarned = false;
    /** Reserve the generation that a managed process will carry before it starts. The capability probe
     * is read-only: a failed/missing ledger yields null and launch continues without fabricating state. */
    reserveOccupantGeneration() {
        try {
            this.db.prepare("SELECT 1 FROM occupant_tenures LIMIT 1").get();
            return randomUUID();
        }
        catch {
            return null;
        }
    }
    /** True only when this exact generation is registered for this exact node. Throws on ledger faults so
     * callers can preserve the distinct generation_resolver_error verdict. */
    isOccupantGenerationRegistered(nodeId, generationUuid) {
        return Boolean(this.db.prepare("SELECT 1 FROM occupant_tenures WHERE node_id = ? AND generation_uuid = ? LIMIT 1").get(nodeId, generationUuid));
    }
    mintOccupantTenure(nodeId, kind, nativeSessionIdAtBoot, reservedGeneration) {
        if (nativeSessionIdAtBoot != null && nativeSessionIdAtBoot !== "") {
            const existing = this.db
                .prepare("SELECT * FROM occupant_tenures WHERE node_id = ? AND native_session_id_at_boot = ? ORDER BY generation_ordinal DESC LIMIT 1")
                .get(nodeId, nativeSessionIdAtBoot);
            if (existing)
                return this.rowToTenure(existing); // continuation — no new generation
        }
        const nextOrdinal = ((this.db
            .prepare("SELECT MAX(generation_ordinal) AS m FROM occupant_tenures WHERE node_id = ?")
            .get(nodeId).m) ?? 0) + 1;
        const id = ulid();
        const generationUuid = reservedGeneration || randomUUID();
        this.db
            .prepare("INSERT INTO occupant_tenures (id, node_id, generation_ordinal, generation_uuid, kind, native_session_id_at_boot) VALUES (?, ?, ?, ?, ?, ?)")
            .run(id, nodeId, nextOrdinal, generationUuid, kind, nativeSessionIdAtBoot ?? null);
        return this.rowToTenure(this.db.prepare("SELECT * FROM occupant_tenures WHERE id = ?").get(id));
    }
    /** The LIVE (latest) occupant generation for a node, or null. Consumers compare an entry's minting
     *  generation_uuid to this to gate stale-generation state (the ghost-stage defect). */
    currentOccupantTenure(nodeId) {
        const row = this.db
            .prepare("SELECT * FROM occupant_tenures WHERE node_id = ? ORDER BY generation_ordinal DESC LIMIT 1")
            .get(nodeId);
        return row ? this.rowToTenure(row) : null;
    }
    /** ghost-stage (b): the LIVE occupant generation_uuid for the node currently backing a session
     *  NAME, or null when UNKNOWN (no session row / no node / no tenure — consumers treat null as
     *  UNKNOWN, never as a match against a stale generation). This is the resolver the compaction
     *  enforcer's gen-scoped stage gate consumes. Never throws (a bad lookup returns null). */
    currentOccupantGenerationForSession(sessionName) {
        try {
            const row = this.db
                .prepare("SELECT node_id FROM sessions WHERE session_name = ? ORDER BY id DESC LIMIT 1")
                .get(sessionName);
            if (!row)
                return null;
            return this.currentOccupantTenure(row.node_id)?.generationUuid ?? null;
        }
        catch {
            return null; // UNKNOWN on any lookup failure (e.g. a db without the tenure ledger)
        }
    }
    rowToTenure(row) {
        return {
            id: row.id,
            nodeId: row.node_id,
            generationOrdinal: row.generation_ordinal,
            generationUuid: row.generation_uuid,
            kind: row.kind,
            nativeSessionIdAtBoot: row.native_session_id_at_boot,
            bootAt: row.boot_at,
        };
    }
    updateStatus(sessionId, status) {
        this.db
            .prepare("UPDATE sessions SET status = ?, intentionally_stopped = 0, last_seen_at = datetime('now') WHERE id = ?")
            .run(status, sessionId);
    }
    /** A supported stop is distinct from an observed exit. Any later status write
     * clears the intent, including a resume of this same session row. */
    markIntentionallyStopped(sessionId) {
        this.db.prepare("UPDATE sessions SET status = 'exited', intentionally_stopped = 1, last_seen_at = datetime('now') WHERE id = ?").run(sessionId);
    }
    updateStartupStatus(sessionId, status, completedAt) {
        if (completedAt) {
            this.db
                .prepare("UPDATE sessions SET startup_status = ?, startup_completed_at = ? WHERE id = ?")
                .run(status, completedAt, sessionId);
        }
        else {
            this.db
                .prepare("UPDATE sessions SET startup_status = ? WHERE id = ?")
                .run(status, sessionId);
        }
    }
    // OPR.0.4.0.22 — resume-token provenance precedence. A deliberate
    // operator/attested set is authoritative and OUTRANKS the runtime hook, the
    // adoption-boundary capture, and the pane scrape (hook > adoption > scrape).
    // A lower-rank write must never clobber a higher-rank persisted token.
    //
    // OPR.0.4.3.20 FR-3 — validity-before-rank guard: an empty/whitespace token
    // is a SKIP, never a write. "Flakiness = missing = no-write, not a bad
    // write." This runs BEFORE the rank comparison so NO caller (a flaky hook,
    // adoption capture, or scrape) can ever replace a valid stored token with an
    // empty one, even from a higher-provenance source.
    //
    // Returns whether a write actually happened: `true` on UPDATE, `false` on an
    // empty-token skip or a lower-rank no-op. Callers that only set-and-forget can
    // ignore it; the adoption-capture path uses it so its audit event never
    // falsely claims a captured write when the provenance guard refused it.
    /** Record that this session was launched for a community agent app, selected through its preset. */
    recordAgentAppSelection(sessionId, app) {
        this.db.prepare("UPDATE sessions SET agent_app = ? WHERE id = ?").run(app, sessionId);
    }
    updateResumeToken(sessionId, type, token, provenance) {
        if (typeof token !== "string" || token.trim().length === 0)
            return false;
        if (provenance) {
            const existing = this.db.prepare("SELECT resume_provenance FROM sessions WHERE id = ?").get(sessionId);
            const existingProv = existing?.resume_provenance ?? null;
            if (existingProv) {
                const existingRank = RESUME_PROVENANCE_RANK[existingProv] ?? -1;
                const newRank = RESUME_PROVENANCE_RANK[provenance] ?? -1;
                if (newRank < existingRank)
                    return false; // lower-rank cannot overwrite higher-rank
            }
        }
        const prov = provenance ?? null;
        // OPR.0.4.3.20 FR-6 — stamp-on-verify (+ equal-value-refresh): a token
        // (re-)derived from live state IS a verification, so refresh the freshness
        // marker + mark the last probe `resumable` on EVERY successful write, even
        // when the token value is unchanged (a re-verified-but-unchanged token must
        // not look untouched). The plan reads these to compute present/stale.
        this.db
            .prepare("UPDATE sessions SET resume_type = ?, resume_token = ?, resume_provenance = COALESCE(?, resume_provenance), " +
            "resume_last_verified = datetime('now'), resume_last_probe_status = 'resumable', " +
            `${CLEAR_ROTATION_ON_TOKEN_CHANGE} WHERE id = ?`)
            .run(type, token, prov, token, token, sessionId);
        return true;
    }
    /** Record a Claude SessionStart hook's session id, with the evidence of how it began (#1077).
     *
     * The write itself follows `updateResumeToken`'s hook rank. The first hook carrying the node's
     * current occupant generation after OpenRig launched this row with `--resume <T1>` consumes that
     * launch, whatever its source: only that hook can name T1 as the token it replaced, and only when
     * it reports `source: "resume"`, a different id, and the launch marker OpenRig put on that
     * process's command (`OPENRIG_RESUME_LAUNCH=T1`), which a Claude started by hand in the pane does
     * not carry, and when the caller observed that the hook came from the launched process itself
     * (`claudeHookFromLaunchedProcess`): a child `claude -p --resume` inherits the marker but is a
     * different process. The rotation keeps that process (pid and start time), and only it may later
     * name T1. Any later hook (an in-process `/resume`, a child `claude -p --resume` sharing the
     * seat's environment, a replacement process) has no launch to name, which leaves today's refusal
     * in place. */
    recordHookSessionIdentity(sessionId, type, token, evidence) {
        return this.db.transaction(() => {
            const launched = this.db.prepare("SELECT resume_launch_token FROM sessions WHERE id = ?").get(sessionId)?.resume_launch_token?.trim() || null;
            const written = this.updateResumeToken(sessionId, type, token, "hook");
            if (launched && evidence.currentGeneration) {
                this.db.prepare("UPDATE sessions SET resume_launch_token = NULL WHERE id = ?").run(sessionId);
                if (written && evidence.source === "resume" && evidence.resumeLaunch?.trim() === launched
                    && evidence.launchedProcess && launched !== token.trim()) {
                    this.db.prepare("UPDATE sessions SET resume_rotated_from = ?, resume_rotated_process = ? WHERE id = ?").run(launched, JSON.stringify({ pid: evidence.launchedProcess.pid, startedAt: evidence.launchedProcess.startedAt }), sessionId);
                }
            }
            return written;
        })();
    }
    /** The resume launch armed for this row and not yet consumed by a hook, if any. */
    armedResumeLaunch(sessionId) {
        return this.db.prepare("SELECT resume_launch_token FROM sessions WHERE id = ?").get(sessionId)?.resume_launch_token?.trim() || null;
    }
    /** Arm the launch about to resume `token` in this row's Claude process (null for a fresh launch).
     *  Recorded before the launch, since the SessionStart hook can land before the launch returns. It
     *  certifies nothing: it only lets the first hook after this launch name the token it replaced. */
    recordResumeLaunch(sessionId, token) {
        this.db.prepare("UPDATE sessions SET resume_launch_token = ?, resume_launch_process = NULL WHERE id = ?").run(token?.trim() || null, sessionId);
    }
    /** The process the launch path observed starting on `token`, right after that launch succeeded
     *  (`observeClaudeResumeLaunch`). Only a rotation whose hook came from this process counts. */
    recordResumeLaunchProcess(sessionId, token, process) {
        this.db.prepare("UPDATE sessions SET resume_launch_process = ? WHERE id = ?")
            .run(JSON.stringify({ token: token.trim(), pid: process.pid, startedAt: process.startedAt }), sessionId);
    }
    /** True when this row's hook-recorded resume rotation started from `token`. */
    claudeResumeRotatedFrom(sessionId, token) {
        const row = this.db.prepare(`SELECT ${CLAUDE_RESUME_ROTATION_COLUMNS} FROM sessions WHERE id = ? AND resume_type = 'claude_id'`).get(sessionId);
        return claudeResumeRotation(row)?.token === token.trim();
    }
    /** A forked occupant (nodes.continuity_outcome = 'forked') whose own id is still pending must never
     *  record an id another session row already holds: in a fork's process that is its parent's
     *  (or a predecessor's) conversation, not its own. */
    isForkClaimingHeldToken(sessionId, type, token) {
        return Boolean(this.db.prepare("SELECT 1 FROM sessions s JOIN nodes n ON n.id = s.node_id WHERE s.id = ? AND n.continuity_outcome = 'forked' " +
            "AND EXISTS (SELECT 1 FROM sessions o WHERE o.id != s.id AND o.resume_type = ? AND o.resume_token = ?)").get(sessionId, type, token));
    }
    /** Test durable identity without returning the stored credential or changing
     *  its provenance. An equal protected token needs no lower-ranked write. */
    resumeTokenMatches(sessionId, type, token) {
        if (!type.trim() || !token.trim())
            return false;
        return Boolean(this.db.prepare("SELECT 1 FROM sessions WHERE id = ? AND resume_type = ? AND resume_token = ?").get(sessionId, type, token));
    }
    /** Preserve a resume target that was attempted but not verified.
     *
     * Attention outcomes include live chooser prompts, runner exits, and
     * readiness timeouts, so reaching one cannot certify the token as resumable.
     * Only fill an empty session row: a concurrent hook/operator write is
     * stronger evidence and must win. */
    recordResumeAttempt(sessionId, type, token) {
        const normalizedType = type.trim();
        const normalizedToken = token.trim();
        if (!normalizedType || !normalizedToken)
            return false;
        const result = this.db
            .prepare("UPDATE sessions SET resume_type = ?, resume_token = ?, resume_provenance = NULL, " +
            "resume_last_verified = NULL, resume_last_probe_status = NULL, resume_rotated_from = NULL, resume_rotated_process = NULL " +
            "WHERE id = ? AND (resume_token IS NULL OR trim(resume_token) = '') " +
            "AND resume_provenance IS NULL AND resume_last_verified IS NULL AND resume_last_probe_status IS NULL")
            .run(normalizedType, normalizedToken, sessionId);
        return result.changes > 0;
    }
    /** OPR.0.4.3.20 FR-6 — record a live resume-probe outcome WITHOUT clearing the
     *  token. On `resumable` it stamps the freshness marker (equal-value-refresh);
     *  on `not_resumable` / `inconclusive` it marks the PRESENT token stale so the
     *  restore plan surfaces it as `stale/unverified — re-verify` (never a silent
     *  null). This replaces the old clear-on-not-resumable behavior (§2.1b) — the
     *  token stays put; FR-7's blank/fresh rollback catches an actually-unresumable
     *  token at restore time. */
    markResumeProbeResult(sessionId, status) {
        if (status === "resumable") {
            this.db
                .prepare("UPDATE sessions SET resume_last_verified = datetime('now'), resume_last_probe_status = 'resumable' WHERE id = ?")
                .run(sessionId);
            return;
        }
        this.db
            .prepare("UPDATE sessions SET resume_last_probe_status = ? WHERE id = ?")
            .run(status, sessionId);
    }
    /** OPR.0.4.0.22 — resolve a canonical session name to the context needed to
     *  set its resume token: the latest session row + its node's runtime + the
     *  current resume provenance. Match inventory's ID ordering: the monotonic
     *  factory preserves registration order through clock rollback in this daemon.
     *  Returns null when no session matches. */
    findResumeContextByName(sessionName) {
        const row = this.db.prepare(`SELECT s.id as session_id, s.node_id, n.rig_id, n.runtime, s.resume_provenance
       FROM sessions s
       JOIN nodes n ON n.id = s.node_id
       WHERE s.session_name = ?
       ORDER BY s.id DESC LIMIT 1`).get(sessionName);
        if (!row)
            return null;
        return {
            sessionId: row.session_id,
            nodeId: row.node_id,
            rigId: row.rig_id,
            runtime: row.runtime,
            currentProvenance: row.resume_provenance ?? null,
        };
    }
    clearResumeToken(sessionId) {
        // OPR.0.4.3.20 FR-6 — also null the verification-freshness columns so a
        // cleared slot carries no orphan freshness. NOTE: after §2.1b the refresher
        // validate path marks-stale instead of clearing, so this has no in-tree
        // caller on the live path; kept for explicit-clear callers/tests.
        this.db
            .prepare("UPDATE sessions SET resume_type = NULL, resume_token = NULL, resume_provenance = NULL, resume_last_verified = NULL, resume_last_probe_status = NULL, resume_rotated_from = NULL, resume_rotated_process = NULL WHERE id = ?")
            .run(sessionId);
    }
    markDetached(sessionId) {
        this.updateStatus(sessionId, "detached");
    }
    markSuperseded(sessionId) {
        this.updateStatus(sessionId, "superseded");
    }
    clearBinding(nodeId) {
        this.db.prepare("DELETE FROM bindings WHERE node_id = ?").run(nodeId);
    }
    getSessionsForRig(rigId) {
        const rows = this.db
            .prepare(`SELECT s.* FROM sessions s
         JOIN nodes n ON s.node_id = n.id
         WHERE n.rig_id = ?
         ORDER BY s.created_at`)
            .all(rigId);
        return rows.map((r) => this.rowToSession(r));
    }
    /**
     * OPR.0.7.0 P1b — live seats for a set of runtimes and one model, used by the
     * provider/model start limiter. Live statuses match the resume/teardown
     * definition (`running` / `idle` / `unknown`). An empty runtime set is 0, and
     * an empty model matches `nodes.model IS NULL` (the "no explicit model" key).
     */
    countLiveSeatsByRuntimesAndModel(runtimes, model) {
        if (runtimes.length === 0)
            return 0;
        const placeholders = runtimes.map(() => "?").join(",");
        const modelClause = model === null ? "n.model IS NULL" : "n.model = ?";
        const params = [...runtimes];
        if (model !== null)
            params.push(model);
        const row = this.db.prepare(`
      SELECT COUNT(*) AS n
      FROM sessions s
      JOIN nodes n ON n.id = s.node_id
      WHERE s.status IN ('running', 'idle', 'unknown')
        AND n.runtime IN (${placeholders})
        AND ${modelClause}
    `).get(...params);
        return Number(row?.n ?? 0);
    }
    /** OPR.0.4.3.20 FR-4 — the latest session PER NODE, filtered to live statuses
     *  (running / idle / unknown), with the fields the resume-metadata refresher
     *  needs. Lifted from rig-teardown so both the teardown pre-down path and the
     *  FR-4 periodic/manual snapshot refresh call ONE query (no duplication). */
    getLatestLiveSessions(rigId) {
        const rows = this.db.prepare(`
      SELECT n.id as node_id, s.id as session_id, s.session_name, s.status, n.runtime, n.cwd, s.resume_type, s.resume_token
      FROM nodes n
      JOIN sessions s ON s.node_id = n.id
      WHERE n.rig_id = ?
        AND s.id = (SELECT s2.id FROM sessions s2 WHERE s2.node_id = n.id ORDER BY s2.created_at DESC, s2.id DESC LIMIT 1)
        AND s.status IN ('running', 'idle', 'unknown')
    `).all(rigId);
        return rows.map((r) => ({
            nodeId: r.node_id,
            sessionId: r.session_id,
            sessionName: r.session_name,
            status: r.status,
            runtime: r.runtime,
            resumeType: r.resume_type,
            resumeToken: r.resume_token,
            cwd: r.cwd,
        }));
    }
    getBindingForNode(nodeId) {
        const row = this.db
            .prepare("SELECT * FROM bindings WHERE node_id = ?")
            .get(nodeId);
        return row ? this.rowToBinding(row) : null;
    }
    updateBinding(nodeId, fields) {
        // Atomic upsert: entire read-modify-write is inside a transaction
        const upsert = this.db.transaction(() => {
            const existing = this.db
                .prepare("SELECT * FROM bindings WHERE node_id = ?")
                .get(nodeId);
            if (existing) {
                // Partial update: only overwrite fields that are provided
                this.db
                    .prepare(`UPDATE bindings SET
              attachment_type = ?,
              tmux_session = ?,
              tmux_window = ?,
              tmux_pane = ?,
              external_session_name = ?,
              cmux_workspace = ?,
              cmux_surface = ?,
              updated_at = datetime('now')
            WHERE node_id = ?`)
                    .run(fields.attachmentType ?? existing.attachment_type ?? "tmux", fields.tmuxSession ?? existing.tmux_session, fields.tmuxWindow ?? existing.tmux_window, fields.tmuxPane ?? existing.tmux_pane, fields.externalSessionName ?? existing.external_session_name, fields.cmuxWorkspace ?? existing.cmux_workspace, fields.cmuxSurface ?? existing.cmux_surface, nodeId);
            }
            else {
                const id = ulid();
                this.db
                    .prepare(`INSERT INTO bindings (id, node_id, attachment_type, tmux_session, tmux_window, tmux_pane, external_session_name, cmux_workspace, cmux_surface)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                    .run(id, nodeId, fields.attachmentType ?? "tmux", fields.tmuxSession ?? null, fields.tmuxWindow ?? null, fields.tmuxPane ?? null, fields.externalSessionName ?? null, fields.cmuxWorkspace ?? null, fields.cmuxSurface ?? null);
            }
        });
        upsert();
        return this.rowToBinding(this.db.prepare("SELECT * FROM bindings WHERE node_id = ?").get(nodeId));
    }
    // -- Row-to-domain mappers --
    rowToSession(row) {
        return {
            id: row.id,
            nodeId: row.node_id,
            sessionName: row.session_name,
            status: row.status,
            resumeType: row.resume_type ?? null,
            resumeToken: row.resume_token ?? null,
            // OPR.0.4.3.20 FR-6 — carry provenance + verification freshness so a
            // snapshot's serialized sessions (and getSessionsForRig) surface token
            // state in the restore plan. Nullable/degrading for pre-45 rows.
            resumeProvenance: row.resume_provenance ?? null,
            resumeLastVerified: row.resume_last_verified ?? null,
            resumeLastProbeStatus: row.resume_last_probe_status ?? null,
            restorePolicy: row.restore_policy ?? "resume_if_possible",
            lastSeenAt: row.last_seen_at,
            createdAt: row.created_at,
            origin: (row.origin === "claimed" ? "claimed" : "launched"),
            startupStatus: row.startup_status ?? "pending",
            startupCompletedAt: row.startup_completed_at ?? null,
            // Present only on a session launched for a community agent app, so other sessions read as before.
            ...(row.agent_app ? { agentApp: row.agent_app } : {}),
        };
    }
    rowToBinding(row) {
        return {
            id: row.id,
            nodeId: row.node_id,
            attachmentType: row.attachment_type ?? "tmux",
            tmuxSession: row.tmux_session,
            tmuxWindow: row.tmux_window,
            tmuxPane: row.tmux_pane,
            externalSessionName: row.external_session_name ?? null,
            cmuxWorkspace: row.cmux_workspace,
            cmuxSurface: row.cmux_surface,
            updatedAt: row.updated_at,
        };
    }
}
const sessionsHaveAgentApp = new WeakMap();
/** The SQL that reads a session's recorded agent app: `<alias>.agent_app`, or NULL on a schema without that column
 *  (as other optional columns are read), so a partial schema reads every seat as before. The schema check is made
 *  once per database: the column only appears through a migration, which runs before these reads. */
export function sessionAgentAppSelect(db, alias = "s") {
    let has = sessionsHaveAgentApp.get(db);
    if (has === undefined) {
        has = db.prepare("PRAGMA table_info(sessions)").all().some(row => row.name === "agent_app");
        sessionsHaveAgentApp.set(db, has);
    }
    return has ? `${alias}.agent_app` : "NULL";
}
//# sourceMappingURL=session-registry.js.map