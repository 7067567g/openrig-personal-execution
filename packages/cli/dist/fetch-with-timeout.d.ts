export declare class FetchTimeoutError extends Error {
    constructor(message: string);
}
export interface FetchWithTimeoutOptions {
    timeoutMs: number;
    timeoutMessage: string;
    /** Consume finite response bodies before releasing the request deadline. */
    consumeResponse?: (response: Response) => Promise<void>;
}
export declare function fetchWithTimeout(fetchImpl: typeof fetch, url: string, init: RequestInit, options: FetchWithTimeoutOptions): Promise<Response>;
//# sourceMappingURL=fetch-with-timeout.d.ts.map