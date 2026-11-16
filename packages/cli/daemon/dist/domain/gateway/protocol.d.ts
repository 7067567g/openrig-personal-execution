export declare const GATEWAY_PROTOCOL_VERSION = 1;
export declare const GATEWAY_MESSAGE_KINDS: readonly ["capability", "outbound_decision", "ack"];
export type GatewayMessageKind = (typeof GATEWAY_MESSAGE_KINDS)[number];
/** connector -> gateway at connect: what this connector can do. `ops` is a CLOSED set;
 *  the gateway dispatches only advertised ops. */
export interface CapabilityDescriptor {
    kind: "capability";
    connectorId: string;
    platform: string;
    protocolVersion: number;
    ops: string[];
    limits?: Record<string, unknown>;
}
/** gateway -> connector: one outbound decision. `op` MUST be advertised; `decisionId` is
 *  the idempotency key. */
export interface OutboundDecision {
    kind: "outbound_decision";
    decisionId: string;
    op: string;
    entityBindingRef: string;
    payload: unknown;
}
/** connector -> gateway: the terminal ack for a decisionId (drives the dispatch buffer's
 *  ack-gated drain). */
export type Ack = {
    kind: "ack";
    decisionId: string;
    ok: true;
} | {
    kind: "ack";
    decisionId: string;
    ok: false;
    failed: {
        class: string;
        detail?: string;
    };
};
export type GatewayMessage = CapabilityDescriptor | OutboundDecision | Ack;
export type DecodeResult = {
    ok: true;
    message: GatewayMessage;
} | {
    ok: false;
    error: string;
};
/** Decode + validate ONE framed JSON message. Unknown kind = LOUD refuse (proof-9);
 *  each kind's required fields are structurally validated (closed union, no partials). */
export declare function decodeGatewayMessage(raw: string): DecodeResult;
/** Encode a message to a framed JSON line (newline-delimited). */
export declare function encodeGatewayMessage(msg: GatewayMessage): string;
/** proof-9 guard: an OutboundDecision op MUST be advertised by the connector's descriptor;
 *  an unadvertised op is REFUSED, never attempted. */
export declare function isAdvertisedOp(descriptor: CapabilityDescriptor, op: string): boolean;
//# sourceMappingURL=protocol.d.ts.map