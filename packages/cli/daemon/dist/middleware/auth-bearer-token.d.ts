import { type NetworkInterfaceInfo } from "node:os";
import type { Context, MiddlewareHandler } from "hono";
/**
 * Constant-time string equality using Node's timingSafeEqual.
 * Returns false when lengths differ (timingSafeEqual throws on
 * length mismatch; we pad-compare to keep a constant-ish branch
 * profile while still returning the honest false).
 */
export declare function constantTimeEqual(a: string, b: string): boolean;
export interface AuthBearerTokenOpts {
    /**
     * The expected bearer token. When this is null, the middleware
     * lets all requests through (the daemon-level startup check
     * elsewhere ensures this only happens when bound on loopback).
     */
    expectedToken: string | null;
}
/**
 * Hono middleware that enforces bearer-token auth on the routes it
 * is mounted on. Returns 401 with a three-part error body for missing
 * or mismatched tokens.
 *
 * When `expectedToken` is null, the middleware passes through. Callers must
 * not treat that as a write boundary by itself: `mutationAuthMiddleware`
 * applies the daemon-wide loopback/non-loopback peer rule independently.
 */
export declare function authBearerTokenMiddleware(opts: AuthBearerTokenOpts): MiddlewareHandler;
/**
 * Recognise a loopback peer address as reported by the accepted socket.
 * This is deliberately separate from {@link isLoopbackBind}: a daemon may
 * listen on `127.0.0.1 + tailnet`, so the bind host cannot tell us whether
 * THIS request arrived locally. Handles IPv4-mapped IPv6 (`::ffff:127.x`)
 * and bracket/zone decorations.
 */
export declare function isLoopbackAddress(address: string | null | undefined): boolean;
export interface MutationAuthOptions {
    /** Operator bearer accepted by ordinary core write routes. */
    operatorBearerToken?: string | null;
    /** Terminal bearer accepted only on terminal/startup/session-scoped routes. */
    terminalBearerToken?: string | null;
    /** Activity hook token accepted only on /api/activity routes. */
    activityHookToken?: string | null;
    /** True when at least one listener is non-loopback, so peer-source checks apply. */
    nonLoopbackBound: boolean;
    /** Test seam; production reads the accepted Node socket's remote address. */
    remoteAddress?: (c: Context) => string | null;
}
/**
 * One admission gate for every mutating /api request.
 *
 * The rule is intentionally source-aware because the daemon may listen on
 * loopback AND Tailscale at once:
 *  - a loopback peer may mutate without a token (local CLI/TUI compatibility);
 *  - a non-loopback peer must present the scoped bearer;
 *  - when no bearer is configured, non-loopback mutations are refused;
 *  - unknown peer identity with a declared non-loopback listener fails closed.
 *
 * Route-specific tokens are scoped rather than global: the terminal bearer
 * cannot authorize `/api/rigs`, and the activity hook token cannot authorize
 * anything outside `/api/activity`.
 */
export declare function mutationAuthMiddleware(opts: MutationAuthOptions): MiddlewareHandler;
/**
 * Detect whether a host bind value is loopback-only (safe to skip
 * bearer requirement) vs non-loopback (tailnet / public; requires
 * bearer). Loopback set: `127.x.x.x`, `::1`, `localhost`. Anything
 * else (including `0.0.0.0`, `::`, named hostnames, tailnet IPs) is
 * treated as non-loopback.
 */
export declare function isLoopbackBind(host: string | undefined | null): boolean;
/**
 * Detect tailscale CGNAT IPv4 (100.64.0.0/10) and ULA IPv6 prefix
 * (fd7a:115c:a1e0::/48). Returns true for tailnet-literal IP addresses
 * only; hostname callers must first resolve via {@link resolveToIpOrNull}.
 *
 * Rationale at startup: tailscale's WireGuard mesh + ACLs are accepted as
 * the bind-level trust boundary, so a tailnet-bound daemon may boot without
 * a bearer. Core WRITES are still separately gated by
 * `mutationAuthMiddleware`, which requires the operator bearer from a
 * non-loopback peer. The CGNAT IPv4 range and ULA IPv6 prefix are reserved
 * by tailscale and documented; collisions are essentially zero.
 *
 * Boundary semantics for HG-3: CGNAT is 100.64.0.0/10 → first octet
 * exactly 100, second octet 64..127 inclusive. 100.63.x.x and
 * 100.128.x.x are NOT tailnet.
 */
export declare function isTailscaleBind(host: string | undefined | null): boolean;
/**
 * Pure helper for {@link detectTailscaleInterface}: takes a NetworkInterfaces
 * dictionary (the shape returned by os.networkInterfaces()) and returns the
 * first non-internal address that matches the tailnet IP ranges, or null.
 * Factored out so tests can supply synthetic interface fixtures without
 * mocking node:os.
 */
export declare function findTailscaleIpInInterfaces(interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>): string | null;
/**
 * Probe the host's network interfaces and return the first tailscale-IP
 * address found (CGNAT IPv4 or tailnet ULA IPv6), or null when no tailnet
 * interface is currently active. Used at daemon startup to decide whether
 * to multi-bind (loopback + tailnet) or loopback-only. Detection is
 * IP-based, not interface-name-based, so it survives platform differences
 * in how tailscale names its tun device.
 */
export declare function detectTailscaleInterface(): string | null;
/**
 * Resolve a hostname to its first IP via node:dns/promises lookup.
 * Returns null on resolution failure (DNS error, timeout, no such host).
 * Wrapped with a 5s race-timeout per Risk 9.2 in the slice IMPL-PRD so an
 * unresponsive resolver does not stall daemon startup indefinitely.
 */
export declare function resolveToIpOrNull(host: string): Promise<string | null>;
export declare class AuthBearerTokenStartupError extends Error {
    constructor(message: string);
}
/**
 * Startup-side check (HARD-GATE audit row 8). Throws an explicit
 * AuthBearerTokenStartupError when the bind interface is genuinely
 * public/LAN AND the bearer token is empty. Loopback or tailscale-IP
 * binds short-circuit at boot (the tailnet is the bind-level trust
 * boundary). Hostname binds resolve via DNS first; if resolution yields a
 * loopback or tailnet IP, the same short-circuit applies. Public/LAN binds
 * without a bearer throw and the daemon refuses to start. This is a BOOT
 * invariant, not the write boundary; core mutations use
 * `mutationAuthMiddleware`.
 */
export declare function assertBindAuthInvariant(opts: {
    host: string;
    bearerToken: string | null;
}): Promise<void>;
//# sourceMappingURL=auth-bearer-token.d.ts.map