import { type ClassifierLeaseManager } from "./classifier-lease-manager.js";
import { type ClassificationAttemptLedger, type ClassificationAttempt } from "./classification-attempts.js";
import { type ProjectClassifier } from "./project-classifier.js";
import type { EventBus } from "./event-bus.js";
import type { StreamStore, StreamItem } from "./stream-store.js";
import type { RegisterWatchdogJobInput } from "./watchdog-jobs-repository.js";
export declare const LABEL_FIELDS: readonly ["classificationType", "classificationUrgency", "classificationMaturity", "classificationConfidence", "classificationDestination", "area", "scopeRef"];
type LabelField = typeof LABEL_FIELDS[number];
export type WorkerLabels = Partial<Record<LabelField, string | null>> & {
    needsHuman?: boolean | null;
    duplicateOfStreamItemId?: string | null;
    /** Positive evidence selected from the supplied duplicate candidates; never a retrieval-miss negative. */
    duplicateEvidenceRef?: string | null;
};
export interface ClassificationCandidates {
    /** Binds taxonomy values, roster and verified scope IDs together. No implicit live lookup. */
    version: string;
    values: Record<LabelField, readonly string[]>;
    duplicateCandidates: readonly {
        streamItemId: string;
        evidenceRef: string;
    }[];
    /** Evidence refs (qitem/PR/KI/etc.) are not selectable scope IDs. */
    relatedRefs: readonly string[];
}
export interface ClassificationRequest {
    readonly item: Readonly<StreamItem>;
    readonly attempt: Readonly<ClassificationAttempt>;
    readonly candidates: Readonly<ClassificationCandidates>;
}
export type ClassificationDecision = {
    kind: "abstain";
    reason: string;
} | {
    kind: "classify";
    labels: WorkerLabels;
};
type AsyncPort<T> = {
    [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => R | Promise<R> : never;
};
export interface WorkerOptions {
    session: string;
    classifierVersion: string;
    taxonomyVersion: string;
    /** Owner-authorized epoch, changed deliberately when new evidence permits another pass. */
    evidenceEpoch: string;
    candidates: ClassificationCandidates;
    classify: (request: ClassificationRequest, signal: AbortSignal) => Promise<ClassificationDecision>;
    leases: AsyncPort<Pick<ClassifierLeaseManager, "evaluateDeadness" | "acquire" | "requireActiveHolder" | "heartbeat">>;
    attempts: AsyncPort<Pick<ClassificationAttemptLedger, "eligible" | "begin" | "abstain" | "fail">>;
    classifier: AsyncPort<Pick<ProjectClassifier, "classify">>;
    stream: AsyncPort<Pick<StreamStore, "getById">>;
    now?: () => Date;
    pageSize?: number;
    requestTimeoutMs?: number;
    leaseBackoffMs?: number;
    signal?: AbortSignal;
    /** Occupant-owned experiment switch; never a daemon taxonomy/policy decision. */
    shouldStop?: () => boolean;
}
export interface WakeResult {
    state: "processed" | "busy" | "classifier_pending" | "lease_backoff" | "lease_lost" | "unavailable" | "stopped";
    nextWakeAt: string;
    reason?: string;
    moreEligible: boolean;
    outcomes: {
        streamItemId: string;
        status: string;
        reason?: string;
    }[];
}
/**
 * Offline/agent-owned worker core. It is NOT instantiated by daemon startup.
 * A selected occupant calls wake() from the existing watchdog/wake cadence.
 * There is no polling loop, scheduler registration, provider or per-item queue here.
 * Notification loss/overflow is harmless: each wake reads one bounded eligible page
 * from its beginning. The durable ledger, not a high-water cursor, excludes done work.
 */
export declare class StreamClassificationWorker {
    private readonly options;
    private readonly now;
    private readonly pageSize;
    private readonly timeoutMs;
    private readonly backoffMs;
    private lease;
    private heartbeatAt;
    private acquireAfter;
    private busy;
    private hinted;
    private pending;
    constructor(options: WorkerOptions);
    /** Optional live/reconnect hint. Calling it a million times stores one boolean. */
    notify(): void;
    /** Subscribe before the first catch-up; events only coalesce a hint, never start work. */
    subscribe(bus: Pick<EventBus, "subscribe">): () => void;
    /** A descriptor for the EXISTING policy; returning it does not register anything. */
    wakeRegistration(registeredBySession: string, targetGenerationUuid?: string): RegisterWatchdogJobInput;
    wake(): Promise<WakeResult>;
    private leasePeriod;
    private maintainLease;
    private decide;
    private stopped;
    private labels;
}
export {};
//# sourceMappingURL=stream-classification-worker.d.ts.map