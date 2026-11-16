import type { HttpHostEntry } from "./hosts-registry-reader.js";
export interface RemoteJsonDeps {
    /** Injected for tests; defaults to global fetch. */
    fetchImpl?: typeof fetch;
    env?: Record<string, string | undefined>;
    readFile?: (path: string) => string;
}
export interface RemoteJsonOptions extends RemoteJsonDeps {
    method: "GET" | "POST";
    body?: unknown;
    /** REQUIRED — the caller names its deadline class explicitly. */
    timeoutMs: number;
    /** P21: extra request headers (e.g. the re-stamped X-OpenRig-Session + X-OpenRig-Relay on a
     *  cross-host forward). Merged AFTER Content-Type/Authorization so a forwarder's identity re-stamp
     *  is what the remote reads — never the inbound body claim. */
    headers?: Record<string, string>;
    /** Stop reading an answer larger than this many bytes (a failure, never parsed). Absent: no bound (today's default). */
    maxBytes?: number;
    /** Absent: fetch's default (follow). "manual": a 3xx comes back as the http failure it is, never followed, and its
     *  body isn't read. */
    redirect?: "follow" | "manual" | "error";
    /** The bearer resolution to send, made by the caller with `resolveBearer` right before this call, so the caller
     *  knows exactly which token went out. Absent: resolved here, as before. */
    resolvedBearer?: ReturnType<typeof resolveBearer>;
}
export type RemoteJsonFailureKind = "bearer" | "timeout" | "network" | "http";
export interface RemoteJsonFailure {
    ok: false;
    kind: RemoteJsonFailureKind;
    /** Response interruption after request delivery cannot settle the operation outcome. */
    outcome?: "indeterminate";
    /** For kind=timeout: whether the deadline fired before headers
     *  ("request") or while reading the body ("body"). */
    phase?: "request" | "body";
    /** HTTP status when headers arrived (including body timeout or network failure). */
    status?: number;
    /** Bearer message / network error message / remote error text (may be ""). */
    detail: string;
    /** The answer exceeded the caller's `maxBytes` and wasn't read further (kind "network"). */
    tooLarge?: true;
}
export type RemoteJsonResult = {
    ok: true;
    status: number;
    payload: unknown;
} | RemoteJsonFailure;
export interface RemoteRawOptions extends RemoteJsonDeps {
    /** REQUIRED — the caller names its deadline class explicitly. */
    timeoutMs: number;
}
export type RemoteRawResult = {
    ok: true;
    status: number;
    contentType: string;
    bodyText: string;
} | {
    ok: false;
    kind: Exclude<RemoteJsonFailureKind, "http">;
    phase?: "request" | "body";
    status?: number;
    detail: string;
};
/** Mirrors the CLI's resolveRemoteBearer (host-registry.ts): at-most-one of
 *  bearer_env / bearer_file, resolved at call time. Neither configured is an
 *  anonymous (URL-only) host — a tokenless daemon; ok with no token, so no
 *  Authorization header is sent. A configured-but-unresolvable pointer still
 *  fails (fail-closed). */
export declare function resolveBearer(host: HttpHostEntry, deps: RemoteJsonDeps): {
    ok: true;
    token?: string;
} | {
    ok: false;
    detail: string;
};
/** One bounded daemon→daemon JSON exchange. The single deadline covers
 *  request + body; every outcome is structured — this function never hangs
 *  and never throws. */
export declare function remoteJsonRequest(host: HttpHostEntry, path: string, opts: RemoteJsonOptions): Promise<RemoteJsonResult>;
/** One bounded daemon→daemon GET, body passed through as text for ANY origin
 *  status (arch P3 verbatim rule). Same bearer resolution + single-deadline +
 *  explicit body race discipline as remoteJsonRequest; never hangs, never
 *  throws. */
export declare function remoteRawRequest(host: HttpHostEntry, path: string, opts: RemoteRawOptions): Promise<RemoteRawResult>;
//# sourceMappingURL=remote-daemon-http.d.ts.map