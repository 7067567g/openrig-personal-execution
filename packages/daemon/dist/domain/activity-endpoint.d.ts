/** OPR.0.4.3.28 B2 — derive the activity ingest URL the daemon injects into seats
 *  from its OWN bound host+port, so the seat's relay posts to an address the
 *  daemon is actually listening on. When OPENRIG_HOST is an explicit host
 *  (loopback, localhost, a tailnet IP, a hostname) the daemon binds ONLY that
 *  host, so the URL MUST use it — a hardcoded 127.0.0.1 would be unreachable.
 *  Wildcard/bind-all hosts (0.0.0.0 / ::) are not connectable addresses and the
 *  daemon also binds loopback there, so they map to 127.0.0.1. An absent host
 *  (the default loopback+tailscale multi-bind) also uses loopback. */
export declare function deriveActivityUrl(host: string | undefined, port: string | undefined): string;
/** Read the durable activity-hook token from state, or generate + persist one.
 *  Stable across restarts (so frozen-env seats keep authenticating). */
export declare function ensureActivityHookToken(stateDir: string): string;
/** Snapshot the current {baseUrl, token} to activity-endpoint.json (mode 0600)
 *  for the relay file-discovery fallback (B3). Best-effort. */
export declare function writeActivityEndpointFile(stateDir: string, endpoint: {
    baseUrl: string;
    token: string;
}): void;
/** Read {baseUrl, token} from activity-endpoint.json, or null if absent/invalid.
 *  (The relay .cjs reads the file directly; this is for daemon-side use + tests.) */
export declare function readActivityEndpointFile(stateDir: string): {
    baseUrl: string;
    token: string;
} | null;
//# sourceMappingURL=activity-endpoint.d.ts.map