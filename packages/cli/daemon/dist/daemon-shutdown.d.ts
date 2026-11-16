export declare const DAEMON_SHUTDOWN_TIMEOUT_MS = 10000;
export declare const DAEMON_STOP_WAIT_MS: number;
export declare const DAEMON_HTTP_CONNECTION_GRACE_MS = 250;
export declare const DAEMON_SHUTDOWN_RECEIPT = "daemon-shutdown.json";
export interface DaemonShutdownReceipt {
    schema: "openrig.daemon-shutdown/v1";
    pid: number;
    startedAt: string;
    completedAt: string;
    outcome: "clean" | "failed" | "timed-out";
    phase: string;
    failures: Array<{
        phase: string;
        error: string;
    }>;
}
interface ServerShutdownHandle {
    close(callback: (error?: Error) => void): unknown;
    closeIdleConnections?: () => void;
}
interface StreamResponse {
    getHeader(name: string): number | string | string[] | undefined;
    writeHead(statusCode: number, ...args: unknown[]): unknown;
    end(): unknown;
    once(event: "close" | "finish", listener: () => void): unknown;
}
/** Register before requests arrive so shutdown can end SSE without cutting ordinary requests. */
export declare function trackHttpServerResponses(server: {
    prependListener(event: "request", listener: (request: unknown, response: StreamResponse) => void): unknown;
}, observeRequest?: (request: unknown, response: unknown) => void): void;
/** Stop accepting requests and end SSE after the grace period. Ordinary requests
 * keep the existing whole-shutdown budget and cannot produce a premature clean stop. */
export declare function closeHttpServer(server: ServerShutdownHandle, graceMs?: number): Promise<void>;
/** One budget for the existing sequential cleanup, including its first await.
 * ponytail: this bounds asynchronous shutdown only; a synchronous event-loop
 * wedge still needs identity-checked operator recovery, not another supervisor. */
export declare function createDaemonShutdown(options: {
    phases: Array<[string, () => unknown]>;
    markClean: () => void;
    receiptPath: string;
    timeoutMs?: number;
    exit?: (code: number) => void;
    log?: (message: string) => void;
}): (signal: string) => void;
export {};
//# sourceMappingURL=daemon-shutdown.d.ts.map