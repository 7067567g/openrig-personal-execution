import { isQueueWait } from "./queue-wait-backoff.js";
/** S16: identifies the one shared provider/account blocker whose own timer expiry
 *  is inherited by its dependent HELD rows. Ordinary blockers remain expiry-less. */
export const USAGE_LIMIT_BLOCKER_TAG = "usage-limit-blocker";
export const USAGE_LIMIT_POOL_TAG_PREFIX = "usage-limit-pool:";
/** One arithmetic for the S16 timer's projected due boundary. The scheduler
 *  enforces the same boundary after the attach leg seeds lastEvaluationAt to
 *  registeredAt. */
export function timerExpiresAt(registeredAt, intervalSeconds) {
    const registeredAtMs = Date.parse(registeredAt);
    if (!Number.isFinite(registeredAtMs) || !Number.isFinite(intervalSeconds))
        return undefined;
    return new Date(registeredAtMs + intervalSeconds * 1000).toISOString();
}
/** Persistence + live-state projection for transition-bound park wakes. */
export class QueueWakeRepository {
    db;
    available;
    constructor(db) {
        this.db = db;
        this.available = this.db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'queue_transition_wakes'").get() !== undefined;
    }
    record(input) {
        if (!this.available)
            return;
        this.db.prepare(`INSERT INTO queue_transition_wakes
        (transition_id, qitem_id, phase, wake_kind, wake_ref, delivery_status)
       VALUES (?, ?, ?, ?, ?, ?)`).run(input.transitionId, input.qitemId, input.phase, input.kind, input.ref, input.deliveryStatus);
    }
    getForTransition(transitionId) {
        if (!this.available)
            return null;
        const row = this.db.prepare("SELECT * FROM queue_transition_wakes WHERE transition_id = ?").get(transitionId);
        return row ? this.row(row) : null;
    }
    getStatus(qitemId) {
        if (!this.available)
            return null;
        const armed = this.db.prepare(`SELECT * FROM queue_transition_wakes
        WHERE qitem_id = ? AND phase = 'armed'
        ORDER BY transition_id DESC LIMIT 1`).get(qitemId);
        if (!armed)
            return null;
        const fired = this.db.prepare(`SELECT * FROM queue_transition_wakes
        WHERE qitem_id = ? AND phase = 'fired' AND wake_ref = ?
          AND transition_id > ?
        ORDER BY transition_id DESC LIMIT 1`).get(qitemId, armed.wake_ref, armed.transition_id);
        const state = this.db.prepare("SELECT state FROM queue_items WHERE qitem_id = ?").get(qitemId)?.state;
        const kind = armed.wake_kind;
        const expiresAt = this.wakeExpiry(qitemId, kind, armed.wake_ref);
        const repeating = this.isRepeatingTimer(armed.wake_ref);
        // A retained attempt (held back by the typing guard) was not delivered, so it doesn't consume a one-shot wake:
        // the backstop is still live and nothing awaits the owner. The attempt stays in the history.
        const heldBack = fired?.delivery_status === "retained" && !repeating;
        return {
            kind,
            ref: armed.wake_ref,
            phase: fired ? "fired" : "armed",
            live: fired && !repeating && !heldBack ? false : this.isLive(kind, armed.wake_ref),
            deliveryStatus: fired?.delivery_status ?? null,
            unconsumed: fired !== undefined && !heldBack && state === "blocked",
            ...(repeating ? { recoveryOwner: "queue-stuck-sweep" } : {}),
            ...(expiresAt ? { expiresAt } : {}),
        };
    }
    /** A blocked row whose current wake is an attached, active `periodic-reminder` aimed at the row's own owner, which
     *  has fired since this park and whose latest delivery reached that owner. Its owner is being woken by that reminder
     *  on its cadence, so parked diagnosis needn't count the row as stranded. Read only from existing records; anything
     *  it can't establish (no fire yet, a failed or retained attempt, a refused or skipped latest evaluation, a stopped
     *  job, another target, a one-shot park timer, a blocker, missing history) answers false, leaving today's result. */
    servedByOwnRepeatingReminder(qitemId) {
        if (!this.available)
            return false;
        const armed = this.db.prepare(`SELECT * FROM queue_transition_wakes
        WHERE qitem_id = ? AND phase = 'armed'
        ORDER BY transition_id DESC LIMIT 1`).get(qitemId);
        if (!armed || armed.wake_kind !== "watchdog")
            return false;
        // That arm must belong to the current park: a row that has left `blocked` since then and was blocked again with no
        // wake of its own (a gate or a person) wrote no arm, so the earlier park's reminder isn't serving this one.
        // Note-only transitions stay `blocked`.
        const leftSince = this.db.prepare(`SELECT 1 FROM queue_transitions WHERE qitem_id = ? AND transition_id > ? AND state <> 'blocked' LIMIT 1`).get(qitemId, armed.transition_id);
        if (leftSince)
            return false;
        const job = this.db.prepare(`SELECT j.policy, j.spec_yaml, j.state, j.target_session, q.destination_session, q.state AS row_state
         FROM watchdog_jobs j JOIN queue_items q ON q.qitem_id = ?
        WHERE j.job_id = ?`).get(qitemId, armed.wake_ref);
        if (!job || job.row_state !== "blocked" || job.policy !== "periodic-reminder" || job.state !== "active"
            || job.target_session !== job.destination_session || isQueueWait(job.spec_yaml))
            return false;
        const fired = this.db.prepare(`SELECT delivery_status FROM queue_transition_wakes
        WHERE qitem_id = ? AND phase = 'fired' AND wake_ref = ? AND transition_id > ?
        ORDER BY transition_id DESC LIMIT 1`).get(qitemId, armed.wake_ref, armed.transition_id);
        if (fired?.delivery_status !== "ok")
            return false;
        // A refusal never reaches the row's own records (it isn't a delivery attempt), so the job's latest evaluation
        // must itself be a delivered send. Latest = the history log's own order: evaluated_at, then history_id (a ULID).
        const hasHistory = this.db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'watchdog_history'").get() !== undefined;
        if (!hasHistory)
            return false;
        // It must have reached this owner: the session the delivery went to, not only the one the job was registered for
        // (a job's spec can name another target). An unknown delivery target keeps today's result.
        const latest = this.db.prepare(`SELECT outcome, delivery_status, delivery_target_session FROM watchdog_history
        WHERE job_id = ? ORDER BY evaluated_at DESC, history_id DESC LIMIT 1`).get(armed.wake_ref);
        return latest?.outcome === "sent" && latest.delivery_status === "ok"
            && latest.delivery_target_session === job.destination_session;
    }
    findBlockedQitemsByWatchdog(jobId, latestArmedOnly = false) {
        if (!this.available)
            return [];
        return this.db.prepare(`SELECT DISTINCT w.qitem_id, w.wake_kind
         FROM queue_transition_wakes w
         JOIN queue_items q ON q.qitem_id = w.qitem_id
        WHERE w.phase = 'armed' AND w.wake_ref = ?
          AND w.wake_kind IN ('watchdog', 'timer') AND q.state = 'blocked'
          -- An operator-owned job can outlive the park that attached it.
          -- Only the latest armed continuation owns this row's wake receipt.
          AND (? = 0 OR w.transition_id = (
            SELECT MAX(a.transition_id) FROM queue_transition_wakes a
             WHERE a.qitem_id = w.qitem_id AND a.phase = 'armed'
          ))
          AND (? OR NOT EXISTS (
            SELECT 1 FROM queue_transition_wakes f
             WHERE f.qitem_id = w.qitem_id AND f.phase = 'fired'
               AND f.wake_ref = w.wake_ref AND f.transition_id > w.transition_id
               -- A retained attempt was not delivered: the one-shot binding still owns the next attempt.
               AND (f.delivery_status IS NULL OR f.delivery_status != 'retained')
          ))`).all(jobId, latestArmedOnly ? 1 : 0, this.isRepeatingTimer(jobId) ? 1 : 0).map((row) => {
            const r = row;
            return { qitemId: r.qitem_id, kind: r.wake_kind };
        });
    }
    /** Queue rows bound to a park-generated timer, regardless of whether that
     *  timer has fired before. Legacy daemons could leave a repeating timer live
     *  after its row closed, so delivery-time defense must consult the original
     *  armed binding rather than only the current blocked/fired projection. */
    findQitemsByGeneratedTimer(jobId) {
        if (!this.available)
            return [];
        return this.db.prepare(`SELECT DISTINCT w.qitem_id, q.state
         FROM queue_transition_wakes w
         JOIN queue_items q ON q.qitem_id = w.qitem_id
        WHERE w.phase = 'armed' AND w.wake_ref = ? AND w.wake_kind = 'timer'`).all(jobId).map((row) => {
            const r = row;
            return { qitemId: r.qitem_id, state: r.state };
        });
    }
    /** A current attachment keeps a shared generated job alive until consumed.
     *  A retained attempt never consumes it; a failed one does, except on a repeating timer, which retries. */
    findLiveQitemsByAttachedWatchdog(jobId) {
        if (!this.available)
            return [];
        return this.db.prepare(`SELECT DISTINCT w.qitem_id, q.state
         FROM queue_transition_wakes w
         JOIN queue_items q ON q.qitem_id = w.qitem_id
        WHERE w.phase = 'armed' AND w.wake_ref = ? AND w.wake_kind = 'watchdog'
          AND q.state = 'blocked'
          AND w.transition_id = (
            SELECT MAX(a.transition_id) FROM queue_transition_wakes a
             WHERE a.qitem_id = w.qitem_id AND a.phase = 'armed'
          )
          AND NOT EXISTS (
            SELECT 1 FROM queue_transition_wakes f
             WHERE f.qitem_id = w.qitem_id AND f.phase = 'fired'
               AND f.wake_ref = w.wake_ref AND f.transition_id > w.transition_id
               -- A retained attempt never consumes an attachment; a failed one consumes it only on a one-shot timer.
               AND (f.delivery_status IS NULL OR f.delivery_status != 'retained')
               AND (? = 0 OR f.delivery_status IS NULL OR (
                 f.delivery_status != 'failed' AND f.delivery_status NOT LIKE 'failed:%'
               ))
          )`).all(jobId, this.isRepeatingTimer(jobId) ? 1 : 0).map((row) => {
            const r = row;
            return { qitemId: r.qitem_id, state: r.state };
        });
    }
    /** The generating row retains timer lifecycle only while its current park
     *  uses this job, including an explicit reattachment to the same job. */
    findCurrentQitemsByGeneratedTimer(jobId) {
        return this.findQitemsByGeneratedTimer(jobId).filter(row => row.state === "blocked" && this.getStatus(row.qitemId)?.ref === jobId);
    }
    /** Active park-generated timers that are still their blocked row's current wake and still target the
     *  row's owner. These wake the seat that owns the row, not a particular occupant, so a seat swap keeps
     *  them; any other job the retiring occupant registered still stops. */
    currentParkTimerIds() {
        if (!this.available)
            return [];
        return this.db.prepare(`SELECT w.wake_ref
         FROM queue_transition_wakes w
         JOIN queue_items q ON q.qitem_id = w.qitem_id
         JOIN watchdog_jobs j ON j.job_id = w.wake_ref
        WHERE w.phase = 'armed' AND w.wake_kind = 'timer'
          AND q.state = 'blocked' AND j.state = 'active' AND j.target_session = q.destination_session
          AND w.transition_id = (
            SELECT MAX(a.transition_id) FROM queue_transition_wakes a
             WHERE a.qitem_id = w.qitem_id AND a.phase = 'armed'
          )`).all().map((row) => row.wake_ref);
    }
    isLive(kind, ref) {
        if (kind === "blocker") {
            const row = this.db.prepare("SELECT state FROM queue_items WHERE qitem_id = ?").get(ref);
            return row !== undefined && ["pending", "in-progress", "blocked"].includes(row.state);
        }
        const row = this.db.prepare("SELECT state FROM watchdog_jobs WHERE job_id = ?").get(ref);
        return row?.state === "active";
    }
    isRepeatingTimer(ref) {
        const row = this.db.prepare("SELECT spec_yaml FROM watchdog_jobs WHERE job_id = ? AND state = 'active'").get(ref);
        return row ? isQueueWait(row.spec_yaml) : false;
    }
    isUsageLimitBlocker(qitemId) {
        const row = this.db.prepare("SELECT tags FROM queue_items WHERE qitem_id = ?").get(qitemId);
        if (!row?.tags)
            return false;
        try {
            return JSON.parse(row.tags).includes(USAGE_LIMIT_BLOCKER_TAG);
        }
        catch {
            return false;
        }
    }
    wakeExpiry(qitemId, kind, ref) {
        if (kind === "timer" && this.isUsageLimitBlocker(qitemId))
            return this.timerExpiry(ref);
        if (kind === "blocker" && this.isUsageLimitBlocker(ref))
            return this.usageLimitBlockerExpiry(ref);
        return undefined;
    }
    usageLimitBlockerExpiry(qitemId) {
        const row = this.db.prepare(`SELECT wake_ref FROM queue_transition_wakes
        WHERE qitem_id = ? AND phase = 'armed' AND wake_kind = 'timer'
        ORDER BY transition_id DESC LIMIT 1`).get(qitemId);
        return row ? this.timerExpiry(row.wake_ref) : undefined;
    }
    timerExpiry(jobId) {
        const row = this.db.prepare("SELECT registered_at, interval_seconds FROM watchdog_jobs WHERE job_id = ?").get(jobId);
        if (!row)
            return undefined;
        return timerExpiresAt(row.registered_at, row.interval_seconds);
    }
    row(row) {
        const kind = row.wake_kind;
        const expiresAt = this.wakeExpiry(row.qitem_id, kind, row.wake_ref);
        return {
            transitionId: row.transition_id,
            qitemId: row.qitem_id,
            phase: row.phase,
            kind,
            ref: row.wake_ref,
            deliveryStatus: row.delivery_status,
            ...(expiresAt ? { expiresAt } : {}),
        };
    }
}
//# sourceMappingURL=queue-wake-repository.js.map