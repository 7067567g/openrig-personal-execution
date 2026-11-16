/**
 * Issue #425, #493: wrap bare IPv6 literals in brackets for URL hosts.
 * `::1` must render as `[::1]` — `http://::1:7433` is rejected by URL parsers.
 * Hostnames, IPv4, and already-bracketed literals pass through unchanged.
 */
export declare function formatDaemonHostForUrl(host: string): string;
//# sourceMappingURL=daemon-url.d.ts.map