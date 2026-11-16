export interface CachedCapture<T> {
    payload: T;
    capturedAt: number;
}
export declare class PreviewRateLimiter<T> {
    private readonly windowMs;
    private readonly now;
    private readonly cache;
    constructor(windowMs: number, now?: () => number);
    /**
     * Returns the cached payload for `sessionName` if it was captured
     * within the rate-limit window; otherwise null. Caller is expected
     * to take a fresh capture and write back via `set` on null.
     */
    get(sessionName: string): CachedCapture<T> | null;
    set(sessionName: string, payload: T): CachedCapture<T>;
    /** Clear cache entry for a session (e.g., on session teardown). */
    clear(sessionName: string): void;
}
//# sourceMappingURL=preview-rate-limiter.d.ts.map