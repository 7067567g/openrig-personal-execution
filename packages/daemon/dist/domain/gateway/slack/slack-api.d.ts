export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;
export interface HttpResult {
    ok: boolean;
    status: number;
    error?: string;
}
/**
 * Post to a Slack incoming webhook. Fail-VISIBLE (item 3): any non-2xx or
 * transport error returns ok:false with a bounded error string — the caller
 * logs loudly and does NOT mark the alert seen (so it retries, never a silent drop).
 *
 * S10: RETIRED from the production path — outbound posts via postChatMessage on the in-daemon
 * subsystem (a webhook cannot carry thread_ts). Kept as a tested generic client; no production
 * caller remains.
 */
export declare function postWebhook(url: string, payload: unknown, fetchImpl?: FetchImpl, timeoutMs?: number): Promise<HttpResult>;
export interface WebApiResult {
    retryAfterSeconds?: number;
    ok: boolean;
    status: number;
    grantedScopes: string[];
    json: Record<string, unknown>;
    error?: string;
}
/** S10 shape-fix — the per-method REQUEST SHAPE. Slack's read methods (conversations.info /
 *  history / replies) reject a JSON POST with `invalid_arguments` (operator-measured live);
 *  their supported shape is GET with URL-query args. The external-upload methods
 *  (files.getUploadURLExternal / files.completeUploadExternal) are sent "form-post": url-encoded
 *  fields, objects/arrays as JSON strings, which is how Slack's own Web API client sends every call.
 *  files.getUploadURLExternal answers a JSON body with `invalid_arguments` ("missing required
 *  field: length / filename") although its reference lists JSON. Write methods (auth.test,
 *  apps.connections.open, chat.postMessage) keep JSON POST byte-identically — the default, so no
 *  existing caller changes shape implicitly. */
export type WebApiRequestShape = "json-post" | "get-query" | "form-post";
/** Call a Slack Web API method (Bearer token) and surface the granted-scope header. */
export declare function callWebApi(method: string, token: string, body: Record<string, unknown>, fetchImpl?: FetchImpl, timeoutMs?: number, shape?: WebApiRequestShape): Promise<WebApiResult>;
/** Item 5: read the ACTUAL granted scopes from the response header (configured != granted). */
export declare function getGrantedScopes(token: string, fetchImpl?: FetchImpl, timeoutMs?: number): Promise<{
    ok: boolean;
    granted: string[];
    error?: string;
}>;
/** OPR.0.5.6.2 — authenticated private-file download (`url_private` + Bearer,
 *  the verified inbound mechanic from the human-layer design §4.1). The host
 *  gate (`isSlackHost`) is enforced HERE so the Bearer token can never reach
 *  a non-Slack URL, whatever caller reaches this function. Bounded:
 *  a body over `maxBytes` is refused, never truncated-and-stored. Slack's
 *  classic auth-failure mode returns an HTML login page with status 200 —
 *  detected by content-type and named, so garbage is never stored as the file.
 *  Errors are MESSAGES, not exceptions: the caller's failure-honesty contract
 *  needs a name per file, never a thrown loss of the whole event. */
export declare const INBOUND_FILE_MAX_BYTES = 26214400;
/** R1 F1 — the anchored Slack-host verdict: https + URL-parsed hostname that is
 *  exactly `slack.com` or ends with `.slack.com`. Never a substring match. */
export declare function isSlackHost(url: string): boolean;
export declare function downloadPrivateFile(url: string, token: string, fetchImpl?: FetchImpl, timeoutMs?: number, maxBytes?: number): Promise<{
    ok: true;
    bytes: Uint8Array;
} | {
    ok: false;
    error: string;
}>;
export interface ScopeVerdict {
    ok: boolean;
    granted: string[];
    missing: string[];
    error?: string;
}
/** Item 5: verify the token actually HAS the required scopes (from the header, not config). */
export declare function verifyScopes(token: string, required: string[], fetchImpl?: FetchImpl, timeoutMs?: number): Promise<ScopeVerdict>;
/** Item 5: verify the bot is actually a MEMBER of the channel before inbound-ready. */
export declare function verifyChannelMembership(token: string, channel: string, fetchImpl?: FetchImpl, timeoutMs?: number): Promise<{
    ok: boolean;
    isMember: boolean;
    name?: string;
    error?: string;
}>;
/** Inbound Socket Mode: open a WebSocket URL via apps.connections.open (app-level xapp token). */
export declare function openSocketConnection(appToken: string, fetchImpl?: FetchImpl, timeoutMs?: number): Promise<{
    ok: boolean;
    url?: string;
    error?: string;
}>;
export declare function getUploadURLExternal(token: string, filename: string, length: number, fetchImpl?: FetchImpl, timeoutMs?: number): Promise<{
    ok: boolean;
    uploadUrl?: string;
    fileId?: string;
    error?: string;
}>;
/** Leg 2: POST the raw bytes to the pre-signed upload URL (octet-stream, no auth header). The
 *  default timeout grows with the size (a screen recording can be tens of MB): 15 s plus 1 s per 512 KiB. */
export declare function uploadBytesExternal(uploadUrl: string, bytes: Uint8Array, fetchImpl?: FetchImpl, timeoutMs?: number): Promise<HttpResult>;
export declare function completeUploadExternal(token: string, input: {
    files: {
        id: string;
        title?: string;
    }[];
    channelId: string;
    threadTs?: string;
    initialComment?: string;
}, fetchImpl?: FetchImpl, timeoutMs?: number): Promise<{
    ok: boolean;
    error?: string;
}>;
/** Search either history order (root newest-first; replies earliest-first) via
 * supported cursors under one total timeout and a finite page bound. A found
 * marker stops the scan; incomplete records partial evidence for the caller.
 * No timestamp cutoff is inferred from in-memory or durable attempt records. */
export declare function fetchRecentMessageTexts(token: string, channel: string, threadTs: string | undefined, fetchImpl?: FetchImpl, limit?: number, timeoutMs?: number, reconcileMarker?: string): Promise<{
    ok: boolean;
    texts: string[];
    messages: {
        text: string;
        ts: string;
    }[];
    error?: string;
    incomplete?: string;
}>;
export interface PostChatMessageInput {
    channel: string;
    text: string;
    blocks?: unknown[];
    /** Thread reply: the PARENT message's ts (never a reply's ts — the affordance discriminator). */
    thread_ts?: string;
}
export type PostChatMessageResult = {
    ok: true;
    status: number;
    ts: string;
} | {
    ok: false;
    status: number;
    error?: string;
};
/** S10 — outbound posting via the Web API (`chat.postMessage`). The R2 native shape needs
 *  thread_ts, which an incoming webhook cannot carry — the webhook path retires with the relay.
 *  A1.2 identity rail: this function NEVER accepts per-message `username`/`icon_*` overrides —
 *  the app's own identity is the only outbound identity (the customize-absence proof leg).
 *  Returns the posted message's ts (the thread anchor for a NEW conversation root). */
export declare function postChatMessage(token: string, input: PostChatMessageInput, fetchImpl?: FetchImpl, timeoutMs?: number, sleep?: (ms: number) => Promise<void>): Promise<PostChatMessageResult>;
//# sourceMappingURL=slack-api.d.ts.map