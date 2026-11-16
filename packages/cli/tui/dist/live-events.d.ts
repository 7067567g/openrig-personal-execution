export interface ActivityEventsSubscription {
    close: () => void;
}
export interface SubscribeActivityEventsOpts {
    /** Opens the SSE stream (daemon-client.openActivityEvents). null = leg unavailable —
     *  disable permanently, never retry. Rejection means a temporary open failure. */
    open: () => Promise<Response | null>;
    /** One pushed oracle change (parsed SSE data line). The consumer refreshes; it never
     *  reads activity fields from the push. */
    onEvent: (event: {
        type: string;
        seatNodeId?: string;
        seq?: number;
    }) => void;
    /** Connection lifecycle notes (drop/reconnect/unavailable) — surfaced, never fatal. */
    onStatus?: (status: "connected" | "dropped" | "reconnecting" | "unavailable") => void;
    /** Initial backoff (ms) after a temporary open failure or stream drop; 30s cap. */
    reconnectDelayMs?: number;
}
export declare function subscribeActivityEvents(opts: SubscribeActivityEventsOpts): ActivityEventsSubscription;
//# sourceMappingURL=live-events.d.ts.map