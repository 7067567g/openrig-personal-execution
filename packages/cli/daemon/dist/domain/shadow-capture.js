import fs from "node:fs/promises";
import path from "node:path";
import { CaptureObserver } from "./capture-observer.js";
// Exclusive creation and a private, canonical parent: never append to/overwrite retained evidence.
async function privateWriter(destination) {
    const parent = path.dirname(destination), actual = await fs.realpath(parent), stat = await fs.stat(parent);
    if (actual !== parent || !stat.isDirectory() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.())
        throw Error("shadow parent must be canonical, owner-only and owned by this process");
    const file = await fs.open(destination, "wx", 0o600);
    return { append: async (text) => { await file.writeFile(text); }, close: () => file.close() };
}
export class ShadowCapture {
    config;
    open;
    observer;
    writer;
    written = 0;
    bytes = 0;
    completedRecords = 0;
    completedBytes = 0;
    dropped = 0;
    sinkErrors = 0;
    error = null;
    stopped = false;
    collecting = true;
    activeDrain;
    stopping;
    constructor(config, open = privateWriter) {
        this.config = config;
        this.open = open;
        this.observer = new CaptureObserver(config);
    }
    async drain() {
        if (this.activeDrain)
            return this.status();
        this.activeDrain = this.observer.drain(async (batch) => {
            for (let i = 0; i < batch.length; i++) {
                const row = batch[i];
                const text = JSON.stringify(row) + "\n", size = Buffer.byteLength(text);
                if (this.stopped || this.written >= this.config.maxRecords || this.bytes + size > this.config.maxBytes) {
                    this.stopped = true;
                    this.dropped++;
                    continue;
                }
                try {
                    this.writer ??= await this.open(this.config.destination);
                    // Reserve before I/O: a partial/failed write never permits replay or budget reuse.
                    this.written++;
                    this.bytes += size;
                    await this.writer.append(text);
                    this.completedRecords++;
                    this.completedBytes += size;
                }
                catch (error) {
                    this.sinkErrors++;
                    this.error = error instanceof Error ? error.message : "sink failed";
                    this.stopped = true;
                    this.dropped += batch.length - i;
                    try {
                        await this.writer?.close();
                    }
                    catch { /* original sink error remains */ }
                    this.writer = undefined;
                    throw error;
                }
            }
            if (this.stopped || this.written >= this.config.maxRecords || this.bytes >= this.config.maxBytes) {
                this.stopped = true;
                try {
                    await this.writer?.close();
                }
                catch (error) {
                    this.sinkErrors++;
                    this.error = error instanceof Error ? error.message : "sink close failed";
                }
                this.writer = undefined;
            }
        }, 64);
        try {
            await this.activeDrain;
        }
        finally {
            this.activeDrain = undefined;
        }
        return this.status();
    }
    /** Disable immediately, then finish the finite retained queue before closing. */
    stop() {
        this.collecting = false;
        this.observer.stopRecording();
        return this.stopping ??= (async () => {
            await this.activeDrain;
            while (this.observer.stats().queued > 0)
                await this.drain();
            this.stopped = true;
            try {
                await this.writer?.close();
            }
            catch {
                this.sinkErrors++;
                this.error = "sink close failed";
            }
            this.writer = undefined;
            return this.status();
        })();
    }
    status() {
        return { enabled: this.collecting && !this.stopped, config: this.config, observer: this.observer.stats(),
            sink: { reservedRecords: this.written, reservedBytes: this.bytes, completedRecords: this.completedRecords, completedBytes: this.completedBytes, dropped: this.dropped, errors: this.sinkErrors, stopped: this.stopped, error: this.error } };
    }
}
/** Source-only opt-in. Missing/invalid configuration never creates a sink or collects bytes. */
export function configureShadowCapture(raw) {
    if (!raw)
        return {};
    try {
        const c = JSON.parse(raw);
        if (typeof c.destination !== "string" || !path.isAbsolute(c.destination) || path.normalize(c.destination) !== c.destination)
            throw Error("explicit absolute private destination required");
        for (const [key, max] of [["maxRecords", 100000], ["maxBytes", 1024 * 1024 * 1024], ["capacity", 1000], ["maxQueuedBytes", 8 * 1024 * 1024], ["maxObservationBytes", 1024 * 1024]]) {
            if (!Number.isSafeInteger(c[key]) || c[key] < 1 || c[key] > max)
                throw Error(`invalid finite ${key}`);
        }
        return { capture: new ShadowCapture(Object.freeze({ ...c })) };
    }
    catch (error) {
        return { error: error instanceof Error ? error.message : "invalid shadow configuration" };
    }
}
/** Inventory has its own probe path. Resolve labels synchronously before that probe awaits. */
export function inventoryCaptureOptions(db, capture) {
    if (!capture)
        return {};
    return { captureObserver: capture.observer, observationBinding: (entry) => {
            try {
                const row = db.prepare(`SELECT b.tmux_pane AS pane, o.generation_uuid AS occupant
        FROM bindings b LEFT JOIN occupant_tenures o ON o.node_id=b.node_id
        AND o.generation_ordinal=(SELECT MAX(generation_ordinal) FROM occupant_tenures WHERE node_id=b.node_id)
        WHERE b.node_id=? AND b.tmux_session=? LIMIT 2`).all(entry.nodeId, entry.canonicalSessionName);
                return { nodeId: entry.nodeId, pane: row.length === 1 ? row[0].pane : null, occupant: row.length === 1 ? row[0].occupant : null };
            }
            catch {
                return { nodeId: entry.nodeId, pane: null, occupant: null };
            }
        } };
}
//# sourceMappingURL=shadow-capture.js.map