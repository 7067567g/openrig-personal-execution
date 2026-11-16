import type { Context, MiddlewareHandler } from "hono";
/**
 * Browser boundary for /api/* (0.6.4). Runs once per request, before the remote
 * read-through and every route, WebSocket upgrades included:
 *
 * 1. Target name (Host). Accepted: `localhost`, IP literals, this machine's own
 *    names (OS hostname, and its exact Tailscale MagicDNS name found by a reverse
 *    lookup of its own tailnet IP at Tailscale's resolver) and OPENRIG_ALLOWED_HOSTS.
 *    A valid configured bearer token in Authorization waives only this check.
 * 2. Browser origin (Origin), when present. Accepted: the daemon's own UI origin
 *    while `ui.enabled` is on, or an entry in OPENRIG_ALLOWED_ORIGINS. Nothing
 *    waives this check.
 *
 * Requests without Origin (CLI, TUI, MCP, daemon-to-daemon) meet only rule 1.
 * This is not complete browser isolation: a cross-site GET/HEAD that carries no
 * Origin and is addressed to an accepted name still reaches its handler.
 */
export interface BrowserBoundaryOptions {
    webUiEnabled: boolean;
    /** Configured bearer tokens; a matching Authorization header waives only the target-name check. */
    bearerTokens: Array<string | null | undefined>;
    /** OPENRIG_ALLOWED_ORIGINS: browser origins only. */
    allowedOrigins?: string;
    /** OPENRIG_ALLOWED_HOSTS: target names only. */
    allowedHosts?: string;
    /** Returns this machine's own extra names (Tailscale MagicDNS). Absent: no discovery. */
    discoverSelfNames?: () => Promise<string[]>;
    discoveryTimeoutMs?: number;
    /** Minimum gap between lookups triggered by unrecognized names. */
    rediscoverAfterMs?: number;
    hostName?: () => string;
    warn?: (line: string) => void;
    now?: () => number;
    /** Test hook: one call per guarded request. */
    onDecision?: (decision: {
        outcome: "allow" | "refuse";
        code?: BoundaryCode;
    }) => void;
}
export type BoundaryCode = "untrusted_host" | "browser_origin_refused";
export type ParsedHost = {
    kind: "absent";
} | {
    kind: "malformed";
} | {
    kind: "ok";
    hostname: string;
    port: string;
};
export type ParsedOrigin = {
    kind: "opaque";
} | {
    kind: "malformed";
} | {
    kind: "ok";
    scheme: string;
    hostname: string;
    port: string;
};
/** Lowercase, drop IPv6 brackets and one trailing dot. */
export declare function normalizeName(name: string): string;
export declare function parseHostHeader(value: string | undefined): ParsedHost;
export declare function parseOrigin(value: string): ParsedOrigin;
/** The OS hostname, its first label, and `<label>.local`. */
export declare function osOwnNames(hostName?: () => string): string[];
/**
 * This machine's exact Tailscale MagicDNS name: a reverse lookup of its own tailnet IP
 * (found from local interfaces), asked of Tailscale's resolver only. One query, bounded
 * by `timeoutMs`; no subprocess, no peer list. Returns [] when no tailnet IP is active.
 */
export declare function discoverTailscaleSelfNames(opts: {
    timeoutMs: number;
    tailscaleIp?: () => string | null;
    reverse?: (ip: string, timeoutMs: number) => Promise<string[]>;
}): Promise<string[]>;
/**
 * One request header as the client sent it. Node adapters expose the original request as
 * `c.env.incoming`, whose `rawHeaders` keep duplicates and empty values; @hono/node-ws builds
 * its Request from the collapsed `incoming.headers`, which keep only the first duplicate and
 * drop empty values. Returns `undefined` when absent and `null` when duplicated (ambiguous).
 * Without a Node request (tests, other adapters) it falls back to the Request headers.
 */
export declare function rawHeader(c: Context, name: "host" | "origin"): string | undefined | null;
export declare function browserBoundary(options: BrowserBoundaryOptions): MiddlewareHandler;
//# sourceMappingURL=browser-boundary.d.ts.map