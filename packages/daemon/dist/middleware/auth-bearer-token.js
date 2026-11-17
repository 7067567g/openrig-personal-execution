// Bearer-token primitives for the daemon.
//
// This file holds two layers:
//  - `authBearerTokenMiddleware`: the legacy per-router bearer check used by
//    Mission Control and other explicitly gated route families;
//  - `mutationAuthMiddleware`: the daemon-wide source-aware gate mounted once
//    on `/api/*` for every mutating method (added after the Round 1 security
//    review). It trusts loopback peers and requires a scoped bearer from
//    non-loopback peers, closing the core rig/up/down/config/workflow/seat
//    routes that previously relied only on the bind posture.
//
// PL-005 Phase B history follows.
//
// Per slice IMPL § Write Set + audit hard-gates 8 + 9:
//   - Constant-time bearer comparison via Node `crypto.timingSafeEqual`.
//     No early-return on byte mismatch.
//   - 401 with three-part error body on missing or mismatched token
//     (what failed + why it matters + what to do).
//   - Daemon refuses to start with a non-loopback bind interface AND
//     empty bearer config — startup-side check (see startup.ts).
//
// MVP context (single-developer, single-user, single-host): one static
// bearer token sourced from a config field. NO OAuth / SSO / per-user
// routing / role-based permissions / token rotation. Token holder is
// fully privileged.
//
// `authBearerTokenMiddleware` is mounted on mission-control write verbs and
// other explicit route families. The daemon-wide `mutationAuthMiddleware`
// is mounted once on `/api/*` (see server.ts). Reads (GET /views, /audit, etc.)
// MAY be gated under the same token at operator option (Phase B
// driver default: gate writes only; reads remain open behind tailnet
// bind for the headed-browser-from-phone case where the operator
// hasn't typed the token into mobile yet — the bearer is for write
// integrity, not view confidentiality).
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import { networkInterfaces } from "node:os";
/**
 * Constant-time string equality using Node's timingSafeEqual.
 * Returns false when lengths differ (timingSafeEqual throws on
 * length mismatch; we pad-compare to keep a constant-ish branch
 * profile while still returning the honest false).
 */
export function constantTimeEqual(a, b) {
    // Length check is unavoidable for timingSafeEqual to work, but the
    // compare is still constant-time within the equal-length case. For
    // unequal lengths we still run a fixed-size compare against a buffer
    // of zeros so an attacker cannot infer "wrong length vs wrong byte"
    // from response timing.
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    if (aBuf.length !== bBuf.length) {
        // Compare against a same-length zero buffer to keep the call site
        // cost similar across mismatch paths. Result is always false here.
        timingSafeEqual(aBuf, Buffer.alloc(aBuf.length));
        return false;
    }
    return timingSafeEqual(aBuf, bBuf);
}
/**
 * Three-part error body shape per OpenRig honest-error-reporting
 * convention. Renders inside the route's c.json call.
 */
function unauthorizedBody(reason) {
    return {
        error: "unauthorized",
        message: `Mission Control auth failed: ${reason}`,
        what_failed: reason,
        why_it_matters: "Mission Control write verbs require a bearer token because the daemon may be bound on a non-loopback interface (tailnet) where unauthenticated mutation would be unsafe.",
        what_to_do: "Set the auth.bearerToken field in daemon config (or OPENRIG_AUTH_BEARER_TOKEN env), restart the daemon, and resend the request with `Authorization: Bearer <token>`.",
    };
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
export function authBearerTokenMiddleware(opts) {
    const { expectedToken } = opts;
    return async (c, next) => {
        if (expectedToken === null) {
            // Loopback-only mode (no bearer configured). Pass through.
            await next();
            return;
        }
        const header = c.req.header("Authorization") ?? c.req.header("authorization");
        if (!header) {
            return c.json(unauthorizedBody("missing Authorization header"), 401);
        }
        const match = /^Bearer\s+(.+)$/i.exec(header);
        if (!match) {
            return c.json(unauthorizedBody("Authorization header must be 'Bearer <token>'"), 401);
        }
        const provided = match[1].trim();
        if (!constantTimeEqual(provided, expectedToken)) {
            return c.json(unauthorizedBody("bearer token does not match"), 401);
        }
        await next();
    };
}
/**
 * Recognise a loopback peer address as reported by the accepted socket.
 * This is deliberately separate from {@link isLoopbackBind}: a daemon may
 * listen on `127.0.0.1 + tailnet`, so the bind host cannot tell us whether
 * THIS request arrived locally. Handles IPv4-mapped IPv6 (`::ffff:127.x`)
 * and bracket/zone decorations.
 */
export function isLoopbackAddress(address) {
    if (!address)
        return false;
    let value = address.trim().toLowerCase();
    if (value.startsWith("[") && value.endsWith("]"))
        value = value.slice(1, -1);
    const zone = value.indexOf("%");
    if (zone >= 0)
        value = value.slice(0, zone);
    if (value.startsWith("::ffff:"))
        value = value.slice("::ffff:".length);
    if (isIP(value) === 4)
        return value.startsWith("127.");
    if (isIP(value) === 6)
        return value === "::1";
    return false;
}
function requestRemoteAddress(c) {
    const env = c.env;
    const bindings = env?.server ?? env;
    const raw = bindings?.incoming?.socket?.remoteAddress;
    return typeof raw === "string" && raw.length > 0 ? raw : null;
}
function bearerValue(header) {
    if (!header)
        return null;
    const match = /^Bearer\s+(.+)$/i.exec(header);
    const token = match?.[1]?.trim();
    return token ? token : null;
}
function requestPath(pathOrUrl) {
    return (pathOrUrl.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
}
/** Routes whose existing auth contract is the terminal bearer (plus operator). */
function isTerminalScopedPath(path) {
    const prefixes = ["/api/transport", "/api/compaction", "/api/terminal", "/api/startup", "/api/sessions"];
    if (prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)))
        return true;
    // The per-rig terminal view is mounted below /api/rigs but is terminal-scoped.
    return /^\/api\/rigs\/[^/]+\/terminal(?:\/|$)/.test(path);
}
function isActivityScopedPath(path) {
    return path === "/api/activity" || path.startsWith("/api/activity/");
}
function mutationAuthFailureBody(input) {
    return {
        ok: false,
        error: {
            code: input.code,
            message: input.whatFailed,
            what_failed: input.whatFailed,
            why_it_matters: input.why,
            what_to_do: input.action,
        },
    };
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
export function mutationAuthMiddleware(opts) {
    const operator = typeof opts.operatorBearerToken === "string" && opts.operatorBearerToken.length > 0
        ? opts.operatorBearerToken : null;
    const terminal = typeof opts.terminalBearerToken === "string" && opts.terminalBearerToken.length > 0
        ? opts.terminalBearerToken : null;
    const activity = typeof opts.activityHookToken === "string" && opts.activityHookToken.length > 0
        ? opts.activityHookToken : null;
    const readRemote = opts.remoteAddress ?? requestRemoteAddress;
    return async (c, next) => {
        const method = c.req.method.toUpperCase();
        if (method !== "POST" && method !== "PUT" && method !== "PATCH" && method !== "DELETE") {
            await next();
            return;
        }
        const path = requestPath(c.req.path);
        const candidates = isTerminalScopedPath(path)
            ? [operator, terminal].filter((value) => value !== null)
            : operator
                ? [operator]
                : [];
        const presented = bearerValue(c.req.header("Authorization") ?? c.req.header("authorization"));
        if (presented && candidates.some((token) => constantTimeEqual(presented, token))) {
            await next();
            return;
        }
        if (isActivityScopedPath(path) && activity) {
            const hookHeader = c.req.header("x-openrig-activity-token");
            if (hookHeader && constantTimeEqual(hookHeader, activity)) {
                await next();
                return;
            }
        }
        // A supplied-but-wrong credential is never silently ignored when this route
        // class has a configured token, even for a loopback peer.
        if (presented && candidates.length > 0) {
            return c.json(mutationAuthFailureBody({
                code: "mutation_auth_required",
                whatFailed: `mutating ${method} ${path} presented a bearer token that does not match this route's operator/terminal token`,
                why: "A stale or foreign credential must not become a silent loopback bypass.",
                action: "Send the daemon's operator bearer (OPENRIG_AUTH_BEARER_TOKEN), or omit the Authorization header on a trusted loopback connection.",
            }), 401, { "WWW-Authenticate": "Bearer realm=\"openrig\"" });
        }
        const remoteAddress = readRemote(c);
        const peerIsLoopback = isLoopbackAddress(remoteAddress);
        // A request-adapter with no socket (unit tests / embedded callers) is only
        // trusted when no non-loopback listener was declared.
        const peerIsKnownTrusted = remoteAddress === null ? !opts.nonLoopbackBound : peerIsLoopback;
        if (peerIsKnownTrusted) {
            await next();
            return;
        }
        if (candidates.length > 0) {
            return c.json(mutationAuthFailureBody({
                code: "mutation_auth_required",
                whatFailed: `mutating ${method} ${path} from non-loopback peer ${remoteAddress ?? "unknown"} requires a bearer token`,
                why: "A non-loopback listener is reachable by other machines; unauthenticated writes could start, stop, or rewire rigs.",
                action: "Send `Authorization: Bearer <token>` using the daemon's operator token (OPENRIG_AUTH_BEARER_TOKEN), or connect over loopback.",
            }), 401, { "WWW-Authenticate": "Bearer realm=\"openrig\"" });
        }
        return c.json(mutationAuthFailureBody({
            code: "non_loopback_mutation_denied",
            whatFailed: `mutating ${method} ${path} from non-loopback peer ${remoteAddress ?? "unknown"} was refused because no bearer token is configured`,
            why: "The daemon is bound beyond loopback, where an unauthenticated mutation would cross the machine trust boundary.",
            action: "Set OPENRIG_AUTH_BEARER_TOKEN before starting the daemon and send it as a Bearer token, or bind only to loopback.",
        }), 403);
    };
}
/**
 * Detect whether a host bind value is loopback-only (safe to skip
 * bearer requirement) vs non-loopback (tailnet / public; requires
 * bearer). Loopback set: `127.x.x.x`, `::1`, `localhost`. Anything
 * else (including `0.0.0.0`, `::`, named hostnames, tailnet IPs) is
 * treated as non-loopback.
 */
export function isLoopbackBind(host) {
    if (!host || host.length === 0) {
        // Default Hono / @hono/node-server bind is 0.0.0.0 — treat as
        // non-loopback for safety (force operator to either bind explicitly
        // to 127.0.0.1 or set the bearer token).
        return false;
    }
    const trimmed = host.trim().toLowerCase();
    if (trimmed === "localhost" || trimmed === "::1" || trimmed === "[::1]")
        return true;
    if (trimmed.startsWith("127."))
        return true;
    return false;
}
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
export function isTailscaleBind(host) {
    if (!host)
        return false;
    const trimmed = host.trim().toLowerCase();
    const ipv4Match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(trimmed);
    if (ipv4Match) {
        const first = parseInt(ipv4Match[1], 10);
        const second = parseInt(ipv4Match[2], 10);
        if (first === 100 && second >= 64 && second <= 127)
            return true;
        return false;
    }
    const cleaned = trimmed.replace(/^\[|\]$/g, "");
    if (cleaned.startsWith("fd7a:115c:a1e0:"))
        return true;
    return false;
}
/**
 * Pure helper for {@link detectTailscaleInterface}: takes a NetworkInterfaces
 * dictionary (the shape returned by os.networkInterfaces()) and returns the
 * first non-internal address that matches the tailnet IP ranges, or null.
 * Factored out so tests can supply synthetic interface fixtures without
 * mocking node:os.
 */
export function findTailscaleIpInInterfaces(interfaces) {
    for (const addrs of Object.values(interfaces)) {
        if (!addrs)
            continue;
        for (const addr of addrs) {
            if (addr.internal)
                continue;
            if (isTailscaleBind(addr.address))
                return addr.address;
        }
    }
    return null;
}
/**
 * Probe the host's network interfaces and return the first tailscale-IP
 * address found (CGNAT IPv4 or tailnet ULA IPv6), or null when no tailnet
 * interface is currently active. Used at daemon startup to decide whether
 * to multi-bind (loopback + tailnet) or loopback-only. Detection is
 * IP-based, not interface-name-based, so it survives platform differences
 * in how tailscale names its tun device.
 */
export function detectTailscaleInterface() {
    return findTailscaleIpInInterfaces(networkInterfaces());
}
/**
 * Resolve a hostname to its first IP via node:dns/promises lookup.
 * Returns null on resolution failure (DNS error, timeout, no such host).
 * Wrapped with a 5s race-timeout per Risk 9.2 in the slice IMPL-PRD so an
 * unresponsive resolver does not stall daemon startup indefinitely.
 */
export async function resolveToIpOrNull(host) {
    try {
        const timeout = new Promise((resolve) => {
            setTimeout(() => resolve(null), 5000).unref();
        });
        const lookup = dns
            .lookup(host, { all: false })
            .then((r) => r.address)
            .catch(() => null);
        return await Promise.race([lookup, timeout]);
    }
    catch {
        return null;
    }
}
export class AuthBearerTokenStartupError extends Error {
    constructor(message) {
        super(message);
        this.name = "AuthBearerTokenStartupError";
    }
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
export async function assertBindAuthInvariant(opts) {
    if (isLoopbackBind(opts.host))
        return;
    if (isTailscaleBind(opts.host))
        return;
    let resolvedIp = null;
    // Hostname (non-IP literal) — resolve and re-check.
    if (!/^[\d.]+$/.test(opts.host) && !opts.host.includes(":")) {
        resolvedIp = await resolveToIpOrNull(opts.host);
        if (resolvedIp) {
            if (isLoopbackBind(resolvedIp))
                return;
            if (isTailscaleBind(resolvedIp))
                return;
        }
    }
    if (opts.bearerToken && opts.bearerToken.length > 0)
        return;
    throw new AuthBearerTokenStartupError(`daemon refusing to start: bind host '${opts.host}'${resolvedIp ? ` (resolves to ${resolvedIp})` : ""} is not loopback or tailscale, ` +
        `and auth.bearerToken (env OPENRIG_AUTH_BEARER_TOKEN) is empty. ` +
        `Either: (a) bind to 127.0.0.1 / localhost, (b) bind to a tailscale interface (100.64.0.0/10 IPv4 or fd7a:115c:a1e0::/48 IPv6), ` +
        `or (c) set OPENRIG_AUTH_BEARER_TOKEN to a non-empty value before starting the daemon.`);
}
//# sourceMappingURL=auth-bearer-token.js.map