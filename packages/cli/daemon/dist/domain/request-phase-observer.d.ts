import type { Context, MiddlewareHandler } from "hono";
import type { SlowOperationInstrumentation } from "./slow-op-recorder.js";
export declare const DIAGNOSTIC_ATTEMPT_HEADER = "x-openrig-diagnostic-attempt";
export declare const DIAGNOSTIC_LIMITS: {
    readonly requestsPerMinute: 128;
    readonly active: 128;
    readonly phases: 16;
    readonly ageMs: 60000;
    readonly tickWindow: 40;
};
type Route = "rigs_list" | "rig_nodes";
type Phase = "node_arrival" | "hono_enter" | "hono_exit" | "handler_enter" | "handler_exit" | "sql_begin" | "sql_end" | "response_finish" | "response_close" | "request_aborted" | "trace_expired";
type Fields = {
    status?: number;
    headersSent?: boolean;
    writableFinished?: boolean;
    failed?: boolean;
};
export type QueryObservation = (phase: "begin" | "end", failed?: boolean) => void;
interface Trace {
    attemptId: string;
    serverRequestId: string;
    route: Route;
    started: number;
    phases: Set<Phase>;
    entered: boolean;
    exited: boolean;
    closed: boolean;
    retired: boolean;
    detach: () => void;
}
export declare function inventoryDiagnosticRoute(method: string | undefined, url: string | undefined): Route | null;
/** Correlation only: never an identity, authorization or deduplication key. */
export declare function inventoryAttemptId(rawHeaders: readonly string[]): string | undefined;
/** Bounded measurement at existing HTTP/tick seams. No timers, I/O wait or request authority. */
export declare class RequestPhaseObserver {
    private readonly sink;
    private readonly now;
    private readonly utc;
    private readonly traces;
    private readonly active;
    private readonly epoch;
    private readonly started;
    private seq;
    private windowStart;
    private admitted;
    private rejected;
    private expired;
    private observerErrors;
    private stopped;
    private ticks;
    constructor(sink: SlowOperationInstrumentation, now?: () => number, utc?: () => string);
    private record;
    private emit;
    /** Called by the existing prepended Node listener, before the adapter callback. */
    observeRequest: (input: unknown, output: unknown) => void;
    private safe;
    private retire;
    middleware(): MiddlewareHandler;
    handler(trace: Trace, phase: "handler_enter" | "handler_exit", fields?: Fields): void;
    query(trace: Trace): QueryObservation;
    /** Reuses EventLoopMonitor's tick; an unfinished stall has no invented end. */
    tick(at: number, previous: number): void;
    close(): void;
}
export declare const observeInventoryHandler: MiddlewareHandler;
export declare function observeInventoryQuery(c: Context): QueryObservation | undefined;
export {};
//# sourceMappingURL=request-phase-observer.d.ts.map