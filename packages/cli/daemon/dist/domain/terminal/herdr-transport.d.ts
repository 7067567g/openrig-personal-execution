/** A herdr socket result body — always carries a `type` discriminator. */
export interface HerdrResult {
    type: string;
    [k: string]: unknown;
}
export interface HerdrProbeResult {
    /** Is the herdr control socket reachable + answering `ping`? */
    alive: boolean;
    version: string | null;
    protocol: number | null;
}
/** One socket round-trip: send {id,method,params}, resolve the matching response body. */
export type HerdrSocketRpc = (req: {
    id: string;
    method: string;
    params: unknown;
}) => Promise<HerdrResult>;
export interface HerdrTransport {
    /** Liveness + version/protocol via the socket `ping` (not the absent CLI). */
    probe(): Promise<HerdrProbeResult>;
    /** Send a socket request; resolve the `result` body, reject on error / no result / unreachable. */
    request(method: string, params: unknown): Promise<HerdrResult>;
}
export type HerdrTransportFactory = () => HerdrTransport;
/** Resolve the herdr control socket path: env override → per-session → default. */
export declare function resolveHerdrSocketPath(env?: NodeJS.ProcessEnv): string;
/** Extract a version token (e.g. from a ping result's `version`, or `herdr --version`). */
export declare function parseHerdrVersion(out: unknown): string | null;
/**
 * Normalize a parsed response line to its result body. Accepts BOTH the wrapped
 * `{id,result:{type,…}}` (layout.apply/workspace.create) and a bare `{type,…}`
 * (ping) shape, and treats an `{…,error:…}` (uncaptured shape, handled
 * defensively) or a shapeless line as an error.
 */
export declare function unwrapHerdrResponse(raw: unknown): HerdrResult;
/**
 * The REAL unix-socket RPC (node:net). One-shot per request: connect, send one
 * newline-delimited JSON line, read lines until the one whose `id` matches (or a
 * bare typed response), then close. Rejects on ENOENT (herdr not running),
 * timeout, connection error, socket close before a response, or a herdr error.
 * Injectable so the adapter/tests never open a real socket.
 */
export declare function createHerdrSocketRpc(socketPath?: string, timeoutMs?: number): HerdrSocketRpc;
/**
 * The socket transport. `request` sends through the injected RPC with a fresh
 * id; `probe` sends `ping` and reads `{type:"pong",version,protocol}`
 * (unreachable / non-pong → alive:false, the honest answer).
 */
export declare function createHerdrSocketTransport(rpc: HerdrSocketRpc): HerdrTransportFactory;
//# sourceMappingURL=herdr-transport.d.ts.map