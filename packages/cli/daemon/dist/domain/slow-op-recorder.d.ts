import type { MiddlewareHandler } from "hono";
export declare const SLOW_OPERATION_BARRIER_TIMEOUT_MS = 250;
export declare const SLOW_OPERATION_THRESHOLD_MS = 250;
export declare const SLOW_OPERATION_ROTATION_BYTES: number;
export declare const SLOW_OPERATION_ROTATION_COUNT = 3;
export declare const SLOW_OPERATION_LOG_BASENAME = "slow-operations.jsonl";
export interface SlowOperationSnapshot {
    healthy: boolean;
    reason?: string;
    site?: string;
}
/**
 * OPR.0.4.3.21 (51elv2) — the named terminal-failure signal. A rejected
 * flush/close carries this error after the recorder Worker is lost, so a
 * caller can never mistake a settled-but-lost drain for a successful durable
 * one (see the terminal transition in {@link SlowOpRecorder}).
 */
export declare class SlowOpRecorderTerminatedError extends Error {
    constructor(reason: string);
}
/**
 * OPR.0.4.3.21 (51elv2) — the named acknowledged-write-failure signal. The
 * Worker is still alive (distinct from {@link SlowOpRecorderTerminatedError}),
 * but it acknowledged that a record could not be durably written; flush()/close()
 * reject with this so a known-lost record can never read as a clean durable drain.
 */
export declare class SlowOpRecorderWriteError extends Error {
    constructor(reason: string);
}
export interface SlowOperationInstrumentation {
    runSync?<T>(site: string, fn: () => T): T;
    runStage?<T>(site: string, fn: () => Promise<T>, classify?: (value: T) => "ok" | "failed"): Promise<T>;
    recordRequest?(site: string, durationMs: number): void;
    /** Bounded nonblocking diagnostic append; false means observation was dropped. */
    recordDiagnostic?(record: Record<string, unknown>): boolean;
    snapshot?(): SlowOperationSnapshot;
    setDegradedHandler?(handler: (snapshot: Required<Pick<SlowOperationSnapshot, "reason" | "site">>) => void): void;
    flush?(): Promise<void>;
    close?(): Promise<void>;
}
export declare function createSlowOpRequestMiddleware(recorder: Pick<SlowOperationInstrumentation, "recordRequest">, now?: () => number): MiddlewareHandler;
interface SlowOpRecorderOptions {
    logPath: string;
    maxBytes?: number;
    rotationCount?: number;
    slowThresholdMs?: number;
    barrierTimeoutMs?: number;
}
interface Span {
    spanId: string;
    site: string;
    startedAt: number;
}
export declare class SlowOpRecorder implements SlowOperationInstrumentation {
    private readonly worker;
    private readonly logPath;
    private readonly maxBytes;
    private readonly rotationCount;
    private readonly slowThresholdMs;
    private readonly barrierTimeoutMs;
    private readonly pending;
    private degraded;
    private degradedHandler?;
    private closed;
    private terminalReason;
    private acknowledgedWriteFailure;
    private diagnosticIds;
    private diagnostic;
    constructor(options: SlowOpRecorderOptions);
    setDegradedHandler(handler: (snapshot: Required<Pick<SlowOperationSnapshot, "reason" | "site">>) => void): void;
    snapshot(): SlowOperationSnapshot;
    beginSyncSpan(site: string): Span;
    runSync<T>(site: string, fn: () => T): T;
    runStage<T>(site: string, fn: () => Promise<T>, classify?: (value: T) => "ok" | "failed"): Promise<T>;
    recordMeasurement(site: string, durationMs: number, outcome?: "ok" | "failed"): void;
    recordRequest(site: string, durationMs: number): void;
    recordDiagnostic(record: Record<string, unknown>): boolean;
    flush(): Promise<void>;
    close(): Promise<void>;
    private endSpan;
    private appendAsync;
    private postAndWait;
    private terminalError;
    /**
     * The single terminal-failure transition for every unrecoverable Worker-loss
     * trigger. Idempotent (settles pending exactly once), marks health degraded
     * with the one-shot high-urgency signal, and rejects every pending waiter so
     * no flush hangs or reports a false durable drain.
     */
    private handleTerminalFailure;
    private markDegraded;
}
export {};
//# sourceMappingURL=slow-op-recorder.d.ts.map