import { type GatewayConnection } from "./transport.js";
export interface GatewayProcessOpts {
    socketPath: string;
    home?: string;
    /** Re-dial cadence while disconnected (also the heartbeat/keepalive tick). */
    reconnectMs?: number;
    onError?: (error: Error) => void;
    onProtocolError?: (error: string) => void;
}
export interface GatewayProcessHandle {
    /** The live connection (undefined between a drop and the next successful re-dial). */
    connection(): GatewayConnection | undefined;
    connected(): boolean;
    /** Tear down: clears the heartbeat and closes the socket (lets the process exit). */
    stop(): void;
}
/** Start the gateway process brain. Returns a handle for lifecycle/tests. Idempotent re-dials are
 *  safe: the durable buffer replays un-Acked decisions on every (re)connect (no-loss). */
export declare function runGatewayProcess(opts: GatewayProcessOpts): GatewayProcessHandle;
//# sourceMappingURL=gateway-process.d.ts.map