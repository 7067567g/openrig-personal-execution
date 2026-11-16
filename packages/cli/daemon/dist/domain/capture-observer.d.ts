/**
 * Read-only capture observer (0.6.0 S01/S02 P2).
 *
 * Records what the send/verify, probe and guard-retention paths ALREADY saw, so a
 * later offline or asynchronous consumer can classify it. It never decides
 * anything: it grants no paste/Enter/replay authority, takes no new capture and
 * never changes the caller's result.
 *
 * `record()` is the only call made on the hot path. It is synchronous, does no
 * I/O, never awaits and never throws: an internal failure is counted, not raised.
 * The queue is bounded; when full, the NEW observation is dropped and counted so
 * denominators stay honest. `drain()` hands bounded batches to an injected
 * consumer; it never replays a batch and never blocks `record()`.
 */
export type ObserverSeam = "send_verify" | "probe_activity" | "retained_no_write";
/**
 * What a capture slot held. `unavailable` never claims a cause it cannot know.
 * captureSeq orders observed capture invocations in one transport process;
 * capturedAt timestamps their return/error. Neither is observation enqueue order
 * or a provider clock. Join persisted evidence by attemptId and pre/post slot.
 */
export type CaptureSlot = {
    state: "captured";
    content: string;
    capturedAt: string;
    captureSeq: number;
}
/** The adapter returned null, which at this base means empty OR failed. */
 | {
    state: "unavailable";
    cause: "empty_or_failed";
    capturedAt: string;
    captureSeq: number;
}
/** The capture call threw: the failure itself is known. */
 | {
    state: "unavailable";
    cause: "capture_error";
    capturedAt: string;
    captureSeq: number;
}
/** This attempt did not ask for this capture (e.g. send without verify). */
 | {
    state: "not_requested";
}
/** Requested, but the attempt ended before reaching it (e.g. paste failed). */
 | {
    state: "not_reached";
};
export interface ObservedBinding {
    sessionName: string;
    nodeId: string | null;
    occupant: string | null;
    pane: string | null;
}
export interface ObservationInput {
    seam: ObserverSeam;
    /** One id per transport attempt; the same attempt's observations share it. */
    attemptId: string;
    binding: ObservedBinding;
    runtime: string | null;
    /** Hash of the sent text, never the text itself; null when nothing was sent. */
    sentHash: string | null;
    pre: CaptureSlot;
    post: CaptureSlot;
    /**
     * The existing regex/transport verdict: only fields the caller actually
     * produced are copied; an absent optional field stays absent, never a verdict.
     */
    regexResult: Record<string, unknown>;
    /** When the attempt completed (distinct from each capture's capturedAt). */
    completedAt: string;
}
export interface Observation extends Readonly<ObservationInput> {
    /** Monotonic order of acceptance into this observer. */
    readonly seq: number;
}
export interface CaptureObserverStats {
    recorded: number;
    dropped: number;
    recordErrors: number;
    missingCaptures: number;
    notRequestedCaptures: number;
    notReachedCaptures: number;
    drained: number;
    consumerFailures: number;
    consumerFailedObservations: number;
    queued: number;
    queuedBytes: number;
    drainingBytes: number;
    droppedBytes: number;
}
export type ObservationConsumer = (batch: readonly Observation[]) => void | Promise<void>;
export declare const DEFAULT_OBSERVER_CAPACITY = 256;
export declare const DEFAULT_DRAIN_BATCH = 64;
export declare function hashSentText(text: string): string;
export declare class CaptureObserver {
    private accepting;
    private readonly capacity;
    private readonly queue;
    private readonly maxQueuedBytes;
    private readonly maxObservationBytes;
    private queuedBytes;
    private drainingBytes;
    private readonly sizes;
    private nextSeq;
    private draining;
    private readonly counters;
    constructor(opts?: {
        capacity?: number;
        maxQueuedBytes?: number;
        maxObservationBytes?: number;
    });
    /** Hot-path entry. Synchronous, no I/O, never throws. */
    record(input: ObservationInput): void;
    /**
     * Hand up to `maxItems` queued observations to `consumer`, in order. Removed
     * before the call: a failing consumer loses that batch (counted), it is never
     * replayed. Concurrent drains are refused (returns 0) rather than awaited.
     */
    drain(consumer: ObservationConsumer, maxItems?: number): Promise<number>;
    stats(): CaptureObserverStats;
    /** Stop new observations; an already queued batch remains available to drain. */
    stopRecording(): void;
}
/** The narrow interface the transport depends on (any sink with a safe record()). */
export interface CaptureObserverSink {
    record(input: ObservationInput): void;
}
//# sourceMappingURL=capture-observer.d.ts.map