export declare function terminalAuthHeaders(): Record<string, string>;
/** The header carrying the caller's seat identity, derived ONCE at the transport chokepoint. */
export declare const SENDER_IDENTITY_HEADER = "X-OpenRig-Session";
/**
 * P18 sender-provenance — derive the caller's identity from the seat ENV (never a request-body
 * claim). Routes that record authorship into the channel of record read ONLY this header, so a
 * buggy/stale caller cannot write false history by fat-fingering or stale-copying a body field.
 * Absent env ⇒ no header ⇒ the daemon DELIVERS and labels the write `claimed:v1` (P18 deliver-and-label;
 * a write with no actor at all is 400 actor_required — parameter completeness, not a refusal). One
 * chokepoint: `DaemonClient.fetch` stamps this on every request; callers never set it by hand.
 */
export declare function senderIdentityHeaders(originSelfHostId?: string): Record<string, string>;
/** Construct registered remote clients with the origin derived from this instance's durable store. */
export declare function remoteDaemonClient(clientFactory: (baseUrl: string) => DaemonClient, url: string, originSelfHostId?: string): DaemonClient;
/** The OS code behind a failed connection (`EPERM`, `ECONNREFUSED`, …) when Node exposes one.
 *  `fetch` reports every connection failure as "fetch failed" and keeps the code on `cause`. */
export declare function connectionErrorCode(err: unknown): string | undefined;
export declare class DaemonConnectionError extends Error {
    /** A write caller cannot infer nondelivery from losing the response. */
    writeOutcome?: "unknown";
    /** #275: the OS cause, so a connection this machine blocked is not rendered as a stopped daemon. */
    causeCode?: string;
    constructor(message: string, causeCode?: string);
}
/**
 * Slow-response: the request reached its bound without a reply. A SUBCLASS of
 * DaemonConnectionError so existing callers still catch it, but distinguishable
 * so the CLI can render "slow, not stopped" instead of daemon-down language.
 */
export declare class DaemonTimeoutError extends DaemonConnectionError {
    constructor(message: string);
}
/**
 * Bad-response: the daemon replied, but the body could not be read or parsed as JSON
 * (truncated / unparseable / non-JSON — a real symptom under daemon saturation).
 * DISTINCT from a stopped or unreachable daemon: the request WAS delivered and
 * the outcome is unknown, so this must never render as daemon-not-running.
 */
export declare class DaemonResponseError extends Error {
    readonly status: number;
    readonly bodySnippet: string;
    constructor(status: number, body: string);
}
export interface DaemonResponse<T = unknown> {
    status: number;
    data: T;
}
/**
 * Issue #425: wrap bare IPv6 literals in brackets for URL hosts. `::1` must
 * render as `[::1]` — `http://::1:7433` never parses in fetch. Hostnames,
 * IPv4, and already-bracketed literals pass through unchanged.
 */
export declare function formatDaemonHostForUrl(host: string): string;
interface DaemonRequestOptions {
    timeoutMs?: number;
    /** Caller cancellation applies to the request and its finite response body. */
    signal?: AbortSignal;
    /** Per-call header overrides (e.g., `Authorization: Bearer ...`). */
    headers?: Record<string, string>;
}
interface DaemonClientOptions {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
}
export declare class DaemonClient {
    readonly baseUrl: string;
    private fetchImpl;
    private timeoutMs;
    /** Set by remoteDaemonClient; absent origin is labelled explicitly on remote requests. */
    originSelfHostId?: string;
    remoteTarget: boolean;
    private identity?;
    private originUnknown;
    private identityHeaders;
    constructor(baseUrl?: string, options?: DaemonClientOptions);
    get<T = unknown>(path: string, options?: DaemonRequestOptions): Promise<DaemonResponse<T>>;
    getText(path: string, options?: DaemonRequestOptions): Promise<DaemonResponse<string>>;
    post<T = unknown>(path: string, body?: unknown, options?: DaemonRequestOptions): Promise<DaemonResponse<T>>;
    postText<T = unknown>(path: string, text: string, contentType?: string, extraHeaders?: Record<string, string>, options?: DaemonRequestOptions): Promise<DaemonResponse<T>>;
    postExpectText(path: string, body?: unknown, options?: DaemonRequestOptions): Promise<DaemonResponse<string>>;
    delete<T = unknown>(path: string, options?: DaemonRequestOptions): Promise<DaemonResponse<T>>;
    put<T = unknown>(path: string, body?: unknown, options?: DaemonRequestOptions): Promise<DaemonResponse<T>>;
    private fetch;
    private requestJson;
    private requestText;
}
export {};
//# sourceMappingURL=client.d.ts.map