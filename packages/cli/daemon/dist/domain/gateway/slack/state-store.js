// Slice-11 slack-connector — durable, restart-surviving state.
//
// Three append-only JSONL stores, written to disk so they survive BOTH a
// connector restart AND a queue-daemon restart (locked item 2 + item 8):
//   - SeenStore     : delivery-dedup by id; a line is appended ONLY AFTER the
//                     side effect succeeds (outbound: after a 200 from Slack;
//                     inbound: after the durable qitem exists). At-least-once —
//                     a crash between success and append re-delivers a
//                     BYTE-IDENTICAL duplicate next run, never a drop.
//   - DeadLetterStore : the inbound never-drop net. An event that fails to land
//                     in the queue is appended (attempt-counted) BEFORE the
//                     failure path returns; drain() truncates and hands the
//                     lines back so the caller re-appends any that fail again
//                     ("zero-drop means zero, not zero-until-the-second-failure").
//   - InboundReceiptStore : credential-free ingress/lifecycle observations,
//                     with received recorded before filtering and a final disposition.
//
// FS + clock are injected so the whole thing is unit-testable with no real disk.
import fs from "node:fs";
import path from "node:path";
export const nodeStateFs = {
    readFileSync: (p) => fs.readFileSync(p, "utf8"),
    // A crash can leave the previous append without its final newline. Separate
    // the next record unconditionally so it cannot become part of that torn JSON.
    // Blank lines are already ignored by parseLines; avoid rereading a growing log.
    appendFileSync: (p, d) => fs.appendFileSync(p, "\n" + d),
    writeFileSync: (p, d) => fs.writeFileSync(p, d),
    rename: (from, to) => fs.renameSync(from, to),
    mkdirp: (dir) => {
        fs.mkdirSync(dir, { recursive: true });
    },
};
function parseLines(raw) {
    return raw
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((l) => {
        try {
            return JSON.parse(l);
        }
        catch {
            return null; // tolerate a torn final line from a crash mid-append
        }
    })
        .filter((x) => x !== null);
}
/**
 * Delivery-dedup log. `load()` reads the durable set from disk; `mark()` appends
 * AFTER the guarded side effect. Idempotent on id: a repeated id collapses in
 * `load()`'s Set, and callers gate the side effect on `!seen.has(id)` so a
 * duplicate is never re-delivered within a run.
 */
export class SeenStore {
    file;
    fsops;
    now;
    constructor(file, fsops = nodeStateFs, now = () => new Date()) {
        this.file = file;
        this.fsops = fsops;
        this.now = now;
    }
    load() {
        let raw;
        try {
            raw = this.fsops.readFileSync(this.file);
        }
        catch {
            return new Set();
        }
        return new Set(parseLines(raw).map((r) => r.id).filter((id) => typeof id === "string"));
    }
    /** Append a seen record. MUST be called only after the guarded side effect succeeds. */
    mark(id, status) {
        this.fsops.mkdirp(path.dirname(this.file));
        this.fsops.appendFileSync(this.file, JSON.stringify({ id, ts: this.now().toISOString(), status }) + "\n");
    }
    /**
     * Seed existing ids as already-seen WITHOUT triggering the side effect
     * (locked item 9: enable-time backlog seeds as history, zero replay storm).
     */
    seed(ids, status = "seeded") {
        if (ids.length === 0)
            return 0;
        this.fsops.mkdirp(path.dirname(this.file));
        const at = this.now().toISOString();
        const chunk = ids.map((id) => JSON.stringify({ id, ts: at, status })).join("\n") + "\n";
        this.fsops.appendFileSync(this.file, chunk);
        return ids.length;
    }
}
/**
 * Inbound never-drop net. Every event that fails to land is appended
 * (attempt-counted) BEFORE the error path returns.
 *
 * INTERRUPTION-SAFE retry (the B2 fix): retry does NOT truncate first. The
 * caller `readAll()`s (non-destructive), attempts each, then `replaceAll()`s the
 * file with ONLY the still-failing entries via an atomic temp-write + rename. So
 * the durable file always reflects the unrecovered set: a crash at ANY point
 * before the rename leaves the ORIGINAL file fully intact (at-least-once — a
 * since-landed event is skipped on re-read via the seen-set, so not even a dup).
 * There is no truncate-before-success window.
 */
export class DeadLetterStore {
    file;
    fsops;
    now;
    constructor(file, fsops = nodeStateFs, now = () => new Date()) {
        this.file = file;
        this.fsops = fsops;
        this.now = now;
    }
    append(ev, attempts) {
        this.fsops.mkdirp(path.dirname(this.file));
        this.fsops.appendFileSync(this.file, JSON.stringify({ ev, at: this.now().toISOString(), attempts }) + "\n");
    }
    /** Non-destructive read of all durable entries. */
    readAll() {
        let raw;
        try {
            raw = this.fsops.readFileSync(this.file);
        }
        catch {
            return [];
        }
        return parseLines(raw);
    }
    /** Non-destructive read that keeps an ABSENT file apart from an UNREADABLE one.
     *  A caller that surfaces a count must not report a false zero when the file
     *  exists but could not be read: absent is a real empty set, any other error is
     *  a named read failure. */
    readResult() {
        let raw;
        try {
            raw = this.fsops.readFileSync(this.file);
        }
        catch (error) {
            if (error.code === "ENOENT")
                return { ok: true, entries: [] };
            return { ok: false, reason: error.message || "dead-letter file could not be read" };
        }
        return { ok: true, entries: parseLines(raw) };
    }
    /** Atomically replace the durable set (temp-write + rename). Used after a retry pass. */
    replaceAll(entries) {
        this.fsops.mkdirp(path.dirname(this.file));
        const body = entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length ? "\n" : "");
        const tmp = `${this.file}.tmp`;
        this.fsops.writeFileSync(tmp, body);
        this.fsops.rename(tmp, this.file); // atomic: original intact until this instant
    }
    /** Finish a retry snapshot without removing entries appended while it awaited I/O.
     * Match occurrences, not just event ids: a later identical append is still owed. */
    replaceBatch(processed, remaining) {
        const counts = new Map();
        for (const entry of processed) {
            const key = JSON.stringify(entry);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const appended = this.readAll().filter((entry) => {
            const key = JSON.stringify(entry);
            const count = counts.get(key) ?? 0;
            if (count === 0)
                return true;
            counts.set(key, count - 1);
            return false;
        });
        this.replaceAll([...remaining, ...appended]);
    }
}
/** Credential-free ingress/lifecycle ledger. A received receipt is appended before
 * handler filtering, then a final typed disposition follows. It deliberately has no
 * message body, sender, token, or secret fields. */
export class InboundReceiptStore {
    file;
    fsops;
    now;
    constructor(file, fsops = nodeStateFs, now = () => new Date()) {
        this.file = file;
        this.fsops = fsops;
        this.now = now;
    }
    append(receipt) {
        this.fsops.mkdirp(path.dirname(this.file));
        this.fsops.appendFileSync(this.file, JSON.stringify({ at: this.now().toISOString(), ...receipt }) + "\n");
    }
    readAll() {
        try {
            return parseLines(this.fsops.readFileSync(this.file));
        }
        catch {
            return [];
        }
    }
}
/** Slack timestamps are decimal seconds with up to six fractional digits, not floats. */
export function slackMicros(value) {
    if (typeof value !== "string" || !/^\d{1,12}\.\d{1,6}$/.test(value))
        return null;
    const [seconds, fraction] = value.split(".");
    return BigInt(seconds) * 1000000n + BigInt(fraction.padEnd(6, "0"));
}
export function slackTimestamp(micros) {
    return `${micros / 1000000n}.${String(micros % 1000000n).padStart(6, "0")}`;
}
function readOptional(file, fsops) {
    try {
        return fsops.readFileSync(file);
    }
    catch (error) {
        if (error.code === "ENOENT")
            return undefined;
        throw error; // Never replace unreadable existing coverage with a new floor.
    }
}
/** A scan boundary, not an event receipt. Status uses an in-memory snapshot, never this file. */
export class ChannelCoverageStore {
    file;
    fsops;
    constructor(file, fsops = nodeStateFs) {
        this.file = file;
        this.fsops = fsops;
    }
    read() {
        const raw = readOptional(this.file, this.fsops);
        if (raw === undefined)
            return {};
        const data = JSON.parse(raw);
        if (!data || typeof data !== "object" || Array.isArray(data))
            throw new Error("invalid coverage store");
        for (const c of Object.values(data)) {
            const start = slackMicros(c?.coverageStart), through = slackMicros(c?.coveredThrough);
            if (start === null || through === null || start > through ||
                !["newest-durable-landing", "feature-adoption"].includes(c.seedBasis) ||
                (c.historyLimited !== undefined && typeof c.historyLimited !== "boolean") ||
                (c.nextRetryAt !== undefined && (!Number.isFinite(c.nextRetryAt) || c.nextRetryAt < 0)))
                throw new Error("invalid coverage checkpoint");
            if (c.pending) {
                const upper = slackMicros(c.pending.upper), next = slackMicros(c.pending.nextLatest);
                if (upper === null || next === null || next <= through || next > upper)
                    throw new Error("invalid pending interval");
            }
        }
        return data;
    }
    save(channel, coverage) {
        const data = this.read();
        Object.defineProperty(data, channel, { value: coverage, enumerable: true, configurable: true });
        this.fsops.mkdirp(path.dirname(this.file));
        this.fsops.writeFileSync(`${this.file}.tmp`, JSON.stringify(data) + "\n");
        this.fsops.rename(`${this.file}.tmp`, this.file);
    }
    initialize(channel, at, seenFile, receiptsFile) {
        const data = this.read();
        if (Object.hasOwn(data, channel))
            return data[channel];
        // Only once per channel. A live event can seed an upgrade, never advance later coverage.
        const candidates = [];
        for (const r of parseLines(readOptional(seenFile, this.fsops) ?? "")) {
            if (typeof r.id === "string" && r.id.startsWith(`${channel}:`))
                candidates.push(r.id.slice(channel.length + 1));
        }
        for (const r of parseLines(readOptional(receiptsFile, this.fsops) ?? "")) {
            if (r.status === "accepted" && r.channel === channel && r.eventTs)
                candidates.push(r.eventTs);
        }
        const valid = candidates.filter(ts => slackMicros(ts) !== null);
        valid.sort((a, b) => slackMicros(a) < slackMicros(b) ? 1 : -1);
        const floor = valid[0] ?? at;
        const coverage = { coverageStart: floor, coveredThrough: floor,
            seedBasis: valid.length ? "newest-durable-landing" : "feature-adoption" };
        this.save(channel, coverage);
        return coverage;
    }
}
//# sourceMappingURL=state-store.js.map