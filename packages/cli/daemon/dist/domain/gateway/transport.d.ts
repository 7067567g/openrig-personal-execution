import type { DispatchBuffer } from "./dispatch-buffer.js";
import { GatewayDispatcher } from "./dispatcher.js";
export interface GatewayConnection {
    dispatcher: GatewayDispatcher;
    close(): void;
}
export interface ConnectOpts {
    socketPath: string;
    buffer: DispatchBuffer;
    /** LOUD surface for a refused/malformed frame (never a silent drop). */
    onProtocolError?: (error: string) => void;
    /** Socket-level error (connector down / dropped). A handler is ALWAYS attached so an
     *  ECONNREFUSED/EPIPE never crashes the daemon — the durable buffer already guarantees
     *  no-loss and the spawn wrapper drives reconnect; this is only the observability surface. */
    onError?: (error: Error) => void;
    /** The socket closed (connector went away). The spawn wrapper uses this to re-dial. */
    onClose?: () => void;
    newDecisionId?: () => string;
}
/** Out-dial the connector socket + wire it to a GatewayDispatcher. On the CapabilityDescriptor
 *  handshake the dispatcher becomes ready and replays any un-Acked decisions (reconnect no-loss);
 *  Ack frames drain the buffer. Returns the dispatcher so the daemon can dispatch decisions. */
export declare function connectGateway(opts: ConnectOpts): GatewayConnection;
//# sourceMappingURL=transport.d.ts.map