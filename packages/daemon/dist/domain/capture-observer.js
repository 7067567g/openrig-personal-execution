import { createHash } from "node:crypto";
export const DEFAULT_OBSERVER_CAPACITY = 256;
export const DEFAULT_DRAIN_BATCH = 64;
function positiveInteger(value, fallback) {
    return value !== undefined && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
export function hashSentText(text) {
    return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}
/** Deep-freeze plain data so a queued observation cannot be mutated later. */
function freeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const v of Object.values(value))
            freeze(v);
    }
    return value;
}
export class CaptureObserver {
    accepting = true;
    capacity;
    queue = [];
    maxQueuedBytes;
    maxObservationBytes;
    queuedBytes = 0;
    drainingBytes = 0;
    sizes = [];
    nextSeq = 1;
    draining = false;
    counters = {
        recorded: 0, dropped: 0, droppedBytes: 0, recordErrors: 0, missingCaptures: 0, notRequestedCaptures: 0, notReachedCaptures: 0,
        drained: 0, consumerFailures: 0, consumerFailedObservations: 0,
    };
    constructor(opts) {
        this.capacity = positiveInteger(opts?.capacity, DEFAULT_OBSERVER_CAPACITY);
        this.maxQueuedBytes = positiveInteger(opts?.maxQueuedBytes, 4 * 1024 * 1024);
        this.maxObservationBytes = positiveInteger(opts?.maxObservationBytes, 256 * 1024);
    }
    /** Hot-path entry. Synchronous, no I/O, never throws. */
    record(input) {
        if (!this.accepting)
            return;
        try {
            for (const slot of [input.pre, input.post]) {
                if (slot.state === "unavailable")
                    this.counters.missingCaptures++;
                else if (slot.state === "not_requested")
                    this.counters.notRequestedCaptures++;
                else if (slot.state === "not_reached")
                    this.counters.notReachedCaptures++;
            }
            if (this.queue.length >= this.capacity) {
                this.counters.dropped++;
                return;
            }
            const contentBytes = [input.pre, input.post].reduce((n, slot) => n + (slot.state === "captured" ? Buffer.byteLength(slot.content) : 0), 0);
            if (contentBytes > this.maxObservationBytes) {
                this.counters.dropped++;
                this.counters.droppedBytes += contentBytes;
                return;
            }
            const observation = freeze({ ...structuredClone(input), seq: this.nextSeq++ });
            const size = Buffer.byteLength(JSON.stringify(observation)) + 1;
            if (size > this.maxObservationBytes || this.queuedBytes + size > this.maxQueuedBytes) {
                this.counters.dropped++;
                this.counters.droppedBytes += size;
                return;
            }
            this.sizes.push(size);
            this.queuedBytes += size;
            this.queue.push(observation);
            this.counters.recorded++;
        }
        catch {
            this.counters.recordErrors++;
        }
    }
    /**
     * Hand up to `maxItems` queued observations to `consumer`, in order. Removed
     * before the call: a failing consumer loses that batch (counted), it is never
     * replayed. Concurrent drains are refused (returns 0) rather than awaited.
     */
    async drain(consumer, maxItems = DEFAULT_DRAIN_BATCH) {
        if (this.draining)
            return 0;
        this.draining = true;
        const batch = Object.freeze(this.queue.splice(0, positiveInteger(maxItems, DEFAULT_DRAIN_BATCH)));
        this.drainingBytes = this.sizes.splice(0, batch.length).reduce((n, size) => n + size, 0);
        this.queuedBytes -= this.drainingBytes;
        try {
            if (batch.length === 0)
                return 0;
            await consumer(batch);
            this.counters.drained += batch.length;
            return batch.length;
        }
        catch {
            this.counters.consumerFailures++;
            this.counters.consumerFailedObservations += batch.length;
            return 0;
        }
        finally {
            this.draining = false;
            this.drainingBytes = 0;
        }
    }
    stats() {
        return { ...this.counters, queued: this.queue.length, queuedBytes: this.queuedBytes, drainingBytes: this.drainingBytes };
    }
    /** Stop new observations; an already queued batch remains available to drain. */
    stopRecording() { this.accepting = false; }
}
//# sourceMappingURL=capture-observer.js.map