import { promises as dnsPromises } from "node:dns";
import { isIP } from "node:net";
import { hostname as osHostname } from "node:os";
import { constantTimeEqual, detectTailscaleInterface } from "./auth-bearer-token.js";
const HOST_HEADER = /^(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9._-]+)(?::(\d{1,5}))?$/;
const DNS_NAME = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
const TAILSCALE_RESOLVER = "100.100.100.100";
const MAX_LOGGED_REFUSALS = 20;
/** Lowercase, drop IPv6 brackets and one trailing dot. */
export function normalizeName(name) {
    let out = name.trim().toLowerCase();
    if (out.startsWith("[") && out.endsWith("]"))
        out = out.slice(1, -1);
    if (out.endsWith("."))
        out = out.slice(0, -1);
    return out;
}
export function parseHostHeader(value) {
    if (value === undefined)
        return { kind: "absent" };
    const match = HOST_HEADER.exec(value);
    if (!match)
        return { kind: "malformed" };
    const rawName = match[1];
    if (rawName.startsWith("[") && isIP(rawName.slice(1, -1)) !== 6)
        return { kind: "malformed" };
    const port = match[2] ?? "80";
    if (Number(port) < 1 || Number(port) > 65535)
        return { kind: "malformed" };
    const hostname = normalizeName(rawName);
    if (!hostname)
        return { kind: "malformed" };
    return { kind: "ok", hostname, port: String(Number(port)) };
}
export function parseOrigin(value) {
    if (value === "null")
        return { kind: "opaque" };
    let url;
    try {
        url = new URL(value);
    }
    catch {
        return { kind: "malformed" };
    }
    if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
        return { kind: "malformed" };
    }
    // An origin is scheme://host[:port]; anything after the authority is not one.
    if (!/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+\/?$/i.test(value))
        return { kind: "malformed" };
    const scheme = url.protocol.slice(0, -1).toLowerCase();
    const port = url.port || (scheme === "https" ? "443" : scheme === "http" ? "80" : "");
    return { kind: "ok", scheme, hostname: normalizeName(url.hostname), port };
}
function isLoopbackOrIp(hostname) {
    return hostname === "localhost" || isIP(hostname) !== 0;
}
/** The OS hostname, its first label, and `<label>.local`. */
export function osOwnNames(hostName = osHostname) {
    const full = normalizeName(hostName() || "");
    if (!full)
        return [];
    const label = full.split(".")[0];
    return [...new Set([full, label, `${label}.local`])];
}
function namesWithShortForm(names) {
    const out = new Set();
    for (const raw of names) {
        const name = normalizeName(raw);
        if (!DNS_NAME.test(name))
            continue;
        out.add(name);
        out.add(name.split(".")[0]);
    }
    return [...out];
}
/**
 * This machine's exact Tailscale MagicDNS name: a reverse lookup of its own tailnet IP
 * (found from local interfaces), asked of Tailscale's resolver only. One query, bounded
 * by `timeoutMs`; no subprocess, no peer list. Returns [] when no tailnet IP is active.
 */
export async function discoverTailscaleSelfNames(opts) {
    const ip = (opts.tailscaleIp ?? detectTailscaleInterface)();
    if (!ip)
        return [];
    const reverse = opts.reverse ?? (async (address, timeoutMs) => {
        const resolver = new dnsPromises.Resolver({ timeout: timeoutMs, tries: 1 });
        resolver.setServers([TAILSCALE_RESOLVER]);
        return resolver.reverse(address);
    });
    return namesWithShortForm(await reverse(ip, opts.timeoutMs));
}
function parseAllowedHosts(raw) {
    const out = new Set();
    for (const item of (raw ?? "").split(",")) {
        const name = normalizeName(item);
        if (name && (DNS_NAME.test(name) || isIP(name) !== 0))
            out.add(name);
    }
    return out;
}
/** OPENRIG_ALLOWED_ORIGINS: a full `http(s)://…` entry matches that exact origin;
 *  any other `scheme://…` entry matches the identical string; a bare hostname matches
 *  that hostname on any scheme and port. */
function parseAllowedOrigins(raw) {
    const origins = new Set();
    const hostnames = new Set();
    const exact = new Set();
    for (const item of (raw ?? "").split(",")) {
        const entry = item.trim().toLowerCase();
        if (!entry)
            continue;
        if (entry.startsWith("http://") || entry.startsWith("https://")) {
            const parsed = parseOrigin(entry.replace(/\/$/, ""));
            if (parsed.kind === "ok")
                origins.add(`${parsed.scheme}://${parsed.hostname}:${parsed.port}`);
        }
        else if (entry.includes("://")) {
            exact.add(entry);
        }
        else {
            hostnames.add(normalizeName(entry));
        }
    }
    return { origins, hostnames, exact };
}
function shown(value) {
    // eslint-disable-next-line no-control-regex
    const clean = value.replace(/[\u0000-\u001f\u007f]/g, "?");
    return clean.length > 200 ? `${clean.slice(0, 200)}…` : clean;
}
/**
 * One request header as the client sent it. Node adapters expose the original request as
 * `c.env.incoming`, whose `rawHeaders` keep duplicates and empty values; @hono/node-ws builds
 * its Request from the collapsed `incoming.headers`, which keep only the first duplicate and
 * drop empty values. Returns `undefined` when absent and `null` when duplicated (ambiguous).
 * Without a Node request (tests, other adapters) it falls back to the Request headers.
 */
export function rawHeader(c, name) {
    const raw = c.env?.incoming?.rawHeaders;
    if (!Array.isArray(raw))
        return c.req.header(name);
    const values = [];
    for (let i = 0; i + 1 < raw.length; i += 2) {
        if (String(raw[i]).toLowerCase() === name)
            values.push(String(raw[i + 1]));
    }
    if (values.length === 0)
        return undefined;
    return values.length === 1 ? values[0] : null;
}
function bearerFrom(header) {
    if (!header)
        return null;
    const match = /^Bearer\s+(.+)$/i.exec(header);
    const token = match?.[1]?.trim();
    return token ? token : null;
}
export function browserBoundary(options) {
    const now = options.now ?? Date.now;
    const warn = options.warn ?? ((line) => console.warn(line));
    const timeoutMs = options.discoveryTimeoutMs ?? 1500;
    const rediscoverAfterMs = options.rediscoverAfterMs ?? 10_000;
    const tokens = options.bearerTokens.filter((t) => typeof t === "string" && t.length > 0);
    const allowedHosts = parseAllowedHosts(options.allowedHosts);
    const allowedOrigins = parseAllowedOrigins(options.allowedOrigins);
    const ownNames = new Set(osOwnNames(options.hostName));
    let discovered = new Set();
    let lastDiscoveryAt = Number.NEGATIVE_INFINITY;
    let inflight = null;
    const discover = () => {
        const source = options.discoverSelfNames;
        if (!source)
            return Promise.resolve();
        if (inflight)
            return inflight;
        inflight = (async () => {
            let timer;
            try {
                const names = await Promise.race([
                    source(),
                    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), timeoutMs + 250); }),
                ]);
                // A completed lookup replaces the set; a failed one keeps the previous names.
                discovered = new Set(namesWithShortForm(names));
            }
            catch {
                // Unavailable, malformed or slow discovery never blocks loopback/IP use.
            }
            finally {
                if (timer)
                    clearTimeout(timer);
                lastDiscoveryAt = now();
                inflight = null;
            }
        })();
        return inflight;
    };
    if (options.discoverSelfNames)
        void discover();
    const knownTarget = (hostname) => isLoopbackOrIp(hostname) || ownNames.has(hostname) || discovered.has(hostname) || allowedHosts.has(hostname);
    const acceptedTarget = async (hostname) => {
        if (knownTarget(hostname))
            return true;
        if (options.discoverSelfNames && (inflight || now() - lastDiscoveryAt >= rediscoverAfterMs)) {
            await discover();
            return knownTarget(hostname);
        }
        return false;
    };
    const explicitlyAllowedOrigin = (raw, origin) => {
        if (allowedOrigins.exact.has(raw.trim().toLowerCase()))
            return true;
        if (origin.kind !== "ok")
            return false;
        if (allowedOrigins.hostnames.has(origin.hostname))
            return true;
        return allowedOrigins.origins.has(`${origin.scheme}://${origin.hostname}:${origin.port}`);
    };
    const logged = new Set();
    let suppressionLogged = false;
    const logRefusal = (c, code, value) => {
        const key = `${code}|${value}`;
        if (logged.has(key))
            return;
        if (logged.size >= MAX_LOGGED_REFUSALS) {
            if (!suppressionLogged) {
                suppressionLogged = true;
                warn("[openrig] browser boundary: further distinct refusals are not logged");
            }
            return;
        }
        logged.add(key);
        warn(`[openrig] browser boundary refused ${code}: ${value} (${c.req.method} ${shown(c.req.path)})`);
    };
    const refuse = (c, code, value, error) => {
        logRefusal(c, code, value);
        options.onDecision?.({ outcome: "refuse", code });
        return c.json({ error, code }, 403);
    };
    return async (c, next) => {
        const hostHeader = rawHeader(c, "host");
        // A duplicated (ambiguous) Host is malformed; an explicitly empty one fails parsing.
        const host = hostHeader === null ? { kind: "malformed" } : parseHostHeader(hostHeader);
        let hostAccepted = false;
        if (host.kind === "malformed") {
            const value = shown(hostHeader === null ? "(duplicate Host)" : hostHeader ?? "");
            return refuse(c, "untrusted_host", value, `This OpenRig daemon refused a request with an unusable Host header ("${value}"). Address the daemon by localhost, an IP address or this machine's own name.`);
        }
        if (host.kind === "ok") {
            hostAccepted = await acceptedTarget(host.hostname);
            if (!hostAccepted) {
                const presented = bearerFrom(c.req.header("Authorization"));
                const tokenValid = presented !== null && tokens.some((token) => constantTimeEqual(presented, token));
                if (!tokenValid) {
                    const value = shown(host.hostname);
                    return refuse(c, "untrusted_host", value, `This OpenRig daemon does not accept requests addressed to "${value}". Use localhost, an IP address or this machine's own name, or add this name to OPENRIG_ALLOWED_HOSTS in the daemon's environment and restart the daemon.`);
                }
            }
        }
        const rawOrigin = rawHeader(c, "origin");
        // A duplicated Origin is malformed; an explicitly empty one is present and fails parsing.
        const originHeader = rawOrigin === null ? "(duplicate Origin)" : rawOrigin;
        if (originHeader !== undefined) {
            const origin = rawOrigin === null ? { kind: "malformed" } : parseOrigin(originHeader);
            const ownUi = options.webUiEnabled && origin.kind === "ok" && origin.scheme === "http"
                && host.kind === "ok" && hostAccepted
                && origin.hostname === host.hostname && origin.port === host.port;
            if (!ownUi && !explicitlyAllowedOrigin(originHeader, origin)) {
                const value = shown(originHeader);
                return refuse(c, "browser_origin_refused", value, `This OpenRig daemon refuses browser requests from origin "${value}". Open the OpenRig UI from the daemon's own address with the web UI enabled (rig config set ui.enabled true, then restart the daemon), or add this exact origin to OPENRIG_ALLOWED_ORIGINS in the daemon's environment and restart. Web pages on other origins cannot read this response.`);
            }
        }
        options.onDecision?.({ outcome: "allow" });
        await next();
    };
}
//# sourceMappingURL=browser-boundary.js.map