import { createHash } from "node:crypto";
export class NotifyEnvelopeError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
export class EventBus {
    subscribers = new Set();
    activeEnvelope = null;
    drainingNotifyRows = false;
    notifyingSubscribers = false;
    notifyEnvelopeRuns = 0;
    notifyDrainStatus;
    db;
    get subscriberCount() {
        return this.subscribers.size;
    }
    constructor(db) {
        this.db = db;
        this.notifyDrainStatus = {
            state: "healthy",
            watermark: this.maxSeq(),
            lastPoison: null,
        };
    }
    /**
     * Persist an event and notify subscribers. Use this for standalone emit
     * outside of a caller-managed transaction.
     */
    emit(event) {
        const persisted = this.persistWithinTransaction(event);
        this.notifySubscribers(persisted);
        return persisted;
    }
    /**
     * Insert an event row into the events table and return a PersistedEvent.
     * Call this inside a caller-managed db.transaction() so the event insert
     * is atomic with other writes (e.g., session + binding + event in one txn).
     * Does NOT notify subscribers. A notify envelope drains after commit;
     * legacy single-event callers retain their explicit post-commit notify.
     */
    persistWithinTransaction(event) {
        const rigId = "rigId" in event ? event.rigId : null;
        const nodeId = "nodeId" in event ? event.nodeId : null;
        const result = this.db
            .prepare("INSERT INTO events (rig_id, node_id, type, payload) VALUES (?, ?, ?, ?)")
            .run(rigId, nodeId, event.type, JSON.stringify(event));
        const seq = Number(result.lastInsertRowid);
        const row = this.db
            .prepare("SELECT created_at FROM events WHERE seq = ?")
            .get(seq);
        const token = {
            ...event,
            seq,
            createdAt: row.created_at,
        };
        this.activeEnvelope?.persisted.add(token);
        return token;
    }
    /**
     * Register an exact token from a nested transactional writer with the
     * caller's active notify envelope. Returns false outside an envelope so the
     * same writer can collect the token for legacy post-commit notification.
     */
    registerPersistedWithinActiveEnvelope(token) {
        if (!this.activeEnvelope)
            return false;
        this.activeEnvelope.registered.add(token);
        return true;
    }
    /**
     * Run one caller-owned synchronous transaction under the W2b notification
     * envelope. Every token persisted through EventBus during the callback must
     * be registered before it returns. The exact object-identity sets are
     * compared before commit; committed rows are then delivered from the log.
     */
    withNotifyEnvelope(callback) {
        if (this.activeEnvelope) {
            throw new NotifyEnvelopeError("nested_notify_envelope", "notify envelope cannot be nested");
        }
        const envelope = { persisted: new Set(), registered: new Set() };
        const register = (token) => {
            envelope.registered.add(token);
        };
        this.notifyEnvelopeRuns += 1;
        const txn = this.db.transaction(() => {
            this.activeEnvelope = envelope;
            try {
                const result = callback(register);
                if (!setsEqual(envelope.persisted, envelope.registered)) {
                    throw new NotifyEnvelopeError("notify_registration_mismatch", `notify envelope persisted ${envelope.persisted.size} token(s) but registered ${envelope.registered.size} exact token(s)`);
                }
                return result;
            }
            finally {
                this.activeEnvelope = null;
            }
        });
        const result = txn();
        this.drainNotifyRowsToQuiescence(this.notifyDrainStatus.watermark);
        return result;
    }
    getNotifyDrainStatus() {
        return {
            ...this.notifyDrainStatus,
            lastPoison: this.notifyDrainStatus.lastPoison
                ? { ...this.notifyDrainStatus.lastPoison }
                : null,
        };
    }
    assertNotifyEnvelopeExercised() {
        if (this.notifyEnvelopeRuns === 0) {
            throw new Error("zero notify envelope transactions examined");
        }
    }
    /**
     * Fan out a persisted event to in-memory subscribers.
     * Does NOT insert into DB. Subscriber errors are isolated.
     */
    notifySubscribers(event) {
        // A subscriber may persist another event. Finish this event's fanout
        // before draining those rows, so all observers see each seq once in order.
        if (this.notifyingSubscribers)
            return;
        const nestedRowsStartAfter = this.maxSeq();
        this.notifyingSubscribers = true;
        try {
            for (const subscriber of this.subscribers) {
                try {
                    subscriber(event);
                }
                catch (err) {
                    console.error("EventBus subscriber error:", err);
                }
            }
        }
        finally {
            this.notifyingSubscribers = false;
        }
        this.notifyDrainStatus.watermark = Math.max(this.notifyDrainStatus.watermark, event.seq);
        if (!this.drainingNotifyRows) {
            this.drainNotifyRowsToQuiescence(nestedRowsStartAfter);
        }
    }
    subscribe(cb) {
        this.subscribers.add(cb);
        return () => {
            this.subscribers.delete(cb);
        };
    }
    replaySince(seq, rigId) {
        const rows = this.db
            .prepare("SELECT seq, rig_id, node_id, type, payload, created_at FROM events WHERE rig_id = ? AND seq > ? ORDER BY seq")
            .all(rigId, seq);
        return rows.map((row) => this.rowToPersistedEvent(row));
    }
    replayAll(seq) {
        const rows = this.rowsAfter(seq);
        return rows.map((row) => this.rowToPersistedEvent(row));
    }
    pageStatements;
    /** Up to `limit` events after `seq` and up to `upTo`, oldest first, of one rig when `rigId` is given: a replay read a
     *  page at a time, which events stored meanwhile never lengthen. */
    replayPage(seq, upTo, limit, rigId) {
        this.pageStatements ??= {
            all: this.db.prepare("SELECT seq, rig_id, node_id, type, payload, created_at FROM events WHERE seq > ? AND seq <= ? ORDER BY seq LIMIT ?"),
            rig: this.db.prepare("SELECT seq, rig_id, node_id, type, payload, created_at FROM events WHERE rig_id = ? AND seq > ? AND seq <= ? ORDER BY seq LIMIT ?"),
        };
        const rows = (rigId ? this.pageStatements.rig.all(rigId, seq, upTo, limit) : this.pageStatements.all.all(seq, upTo, limit));
        return rows.map((row) => this.rowToPersistedEvent(row));
    }
    /** The seq after which the newest `count` events start (of one rig when `rigId` is given): 0 when there are no more
     *  than `count`, the newest seq for 0. A count past a safe integer is more than any log holds: never an OFFSET SQLite
     *  cannot take. */
    seqBeforeNewest(count, rigId) {
        if (count === 0)
            return this.maxSeq();
        if (!Number.isSafeInteger(count))
            return 0;
        const row = (rigId
            ? this.db.prepare("SELECT seq FROM events WHERE rig_id = ? ORDER BY seq DESC LIMIT 1 OFFSET ?").get(rigId, count)
            : this.db.prepare("SELECT seq FROM events ORDER BY seq DESC LIMIT 1 OFFSET ?").get(count));
        return row?.seq ?? 0;
    }
    drainNotifyRowsToQuiescence(startAfter) {
        if (this.drainingNotifyRows || this.notifyingSubscribers)
            return;
        this.drainingNotifyRows = true;
        let cursor = startAfter;
        try {
            for (;;) {
                const rows = this.rowsAfter(cursor);
                if (rows.length === 0)
                    return;
                for (const row of rows) {
                    let event;
                    try {
                        event = this.rowToPersistedEvent(row);
                    }
                    catch (caught) {
                        const error = caught instanceof SyntaxError
                            ? "invalid event payload JSON"
                            : "invalid event payload shape";
                        const payloadSha = createHash("sha256").update(row.payload).digest("hex");
                        this.notifyDrainStatus = {
                            state: "unparseable",
                            watermark: row.seq,
                            lastPoison: { seq: row.seq, error, payloadSha },
                        };
                        this.persistWithinTransaction({
                            type: "event.delivery_poisoned",
                            poisonedSeq: row.seq,
                            error,
                            payloadSha,
                        });
                        cursor = row.seq;
                        continue;
                    }
                    this.notifySubscribers(event);
                    cursor = row.seq;
                }
            }
        }
        finally {
            this.drainingNotifyRows = false;
        }
    }
    /** The newest stored event's seq, 0 for an empty log. */
    maxSeq() {
        const row = this.db.prepare("SELECT MAX(seq) AS seq FROM events").get();
        return row.seq ?? 0;
    }
    rowsAfter(seq) {
        return this.db
            .prepare("SELECT seq, rig_id, node_id, type, payload, created_at FROM events WHERE seq > ? ORDER BY seq")
            .all(seq);
    }
    rowToPersistedEvent(row) {
        const parsed = JSON.parse(row.payload);
        if (typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed) ||
            typeof parsed.type !== "string" ||
            parsed.type.length === 0) {
            throw new Error("invalid event payload shape");
        }
        const event = parsed;
        return {
            ...event,
            seq: row.seq,
            createdAt: row.created_at,
        };
    }
}
function setsEqual(left, right) {
    if (left.size !== right.size)
        return false;
    for (const value of left) {
        if (!right.has(value))
            return false;
    }
    return true;
}
//# sourceMappingURL=event-bus.js.map