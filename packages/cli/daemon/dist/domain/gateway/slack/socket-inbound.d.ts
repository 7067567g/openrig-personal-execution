import { type FetchImpl } from "./slack-api.js";
import { type InboundRouter } from "./inbound.js";
import type { InboundReceiptStore, InboundReceiptStatus } from "./state-store.js";
export interface WsLike {
    send(data: string): void;
    close(): void;
    onopen: ((this: unknown, ev?: unknown) => void) | null;
    onmessage: ((this: unknown, ev: {
        data: unknown;
    }) => void) | null;
    onclose: ((this: unknown, ev?: unknown) => void) | null;
    onerror: ((this: unknown, ev?: unknown) => void) | null;
}
export interface PingChannel {
    subscribe(onMessage: (message: unknown) => void): void;
    unsubscribe(onMessage: (message: unknown) => void): void;
}
export interface SocketInboundDeps {
    fetchImpl?: FetchImpl;
    /** Open a Socket Mode WebSocket (default: global WebSocket). Injectable for tests. */
    wsFactory?: (url: string) => WsLike;
    /** Test seam: run N reconnect cycles then stop (default: forever, until stop()). */
    inboundMaxConnects?: number;
    /** Dead-letter retry cadence WHILE the socket stays connected (default 5min). */
    retryIntervalMs?: number;
    /** How long a new socket may stay opening before it is abandoned and retried (default 30s). */
    openTimeoutMs?: number;
    /** Server WebSocket pings (default: undici's `undici:websocket:ping` diagnostics channel). */
    pingChannel?: PingChannel;
    /** Without a server ping for this long, once one has arrived, the connection is stale (default
     *  30s, the default of Slack's own Node client). */
    serverPingTimeoutMs?: number;
    /** A post of ours whose echo has not arrived after this long counts as missing (default 60s). */
    echoTimeoutMs?: number;
    /** Minimum gap between automatic replacements (default 5min). Slack's own refresh ignores it. */
    minAutoReplaceIntervalMs?: number;
    /** How often liveness is checked (default 5s). */
    livenessCheckMs?: number;
    receipts?: InboundReceiptStore;
    recovery?: {
        run(): Promise<void>;
        stop(): void;
    };
    log?: (msg: string) => void;
}
export interface SocketInboundHandle {
    /** Resolves when the loop ends (maxConnects reached or stop() called). */
    done: Promise<void>;
    stop(): void;
    status(): SocketInboundStatus;
    /** A message we just posted (its Slack ts): a healthy connection receives it back as an event. */
    expectEcho(messageTs: string): void;
}
/** Delivery health, kept apart from the socket state so "connected" is never the only word. */
export type SocketDelivery = "unknown" | "delivering" | "no-server-pings" | "events-missing" | "socket-mode-disabled";
export interface SocketInboundStatus {
    generation: number;
    reconnects: number;
    state: "connecting" | "connected" | "disconnected" | "stopped";
    connectedAt?: string;
    disconnectedAt?: string;
    lastEventAt?: string;
    lastEventTs?: string;
    lastDisposition?: InboundReceiptStatus;
    delivery?: SocketDelivery;
    lastServerPingAt?: string;
    /** The oldest of our posts still waiting for its echo, once two have gone missing. */
    eventsMissingSince?: string;
    unechoedPosts?: number;
    lastAutoReconnect?: {
        at: string;
        reason: string;
    };
    /** An automatic replacement the 5-minute limit is holding back, until this time. */
    autoReconnectSuppressedUntil?: string;
    /** Slack's `hello` count of this app's open connections, ours included. */
    numConnections?: number;
    /** Connections in `numConnections` that are not open on our side: above 0 means another consumer. */
    otherConnections?: number;
    /** Those may be ours instead: Slack counted just after we closed a connection, or on this loop's
     *  first connection, which follows a restart or re-enable. */
    otherConnectionsMayBeOurs?: boolean;
}
/** Start the Socket Mode loop (the shipped runner's exact shape, service-ified with a stop()). */
export declare function startSocketInbound(appToken: string, router: InboundRouter, deps?: SocketInboundDeps): SocketInboundHandle;
//# sourceMappingURL=socket-inbound.d.ts.map