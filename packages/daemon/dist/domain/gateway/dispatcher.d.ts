import type { DispatchBuffer } from "./dispatch-buffer.js";
import { type CapabilityDescriptor, type OutboundDecision } from "./protocol.js";
export interface DispatcherDeps {
    buffer: DispatchBuffer;
    /** The transport write (a framed unix-socket send in prod; an in-memory sink in tests). */
    send: (decision: OutboundDecision) => void;
    /** Injectable id source (tests pin decisionIds; prod = a UUID). */
    newDecisionId?: () => string;
}
export type DispatchResult = {
    ok: true;
    decisionId: string;
} | {
    ok: false;
    error: string;
};
export declare class GatewayDispatcher {
    private readonly deps;
    private descriptor;
    constructor(deps: DispatcherDeps);
    /** Handshake — record the connector's advertised capabilities. */
    onCapability(descriptor: CapabilityDescriptor): void;
    get connectorId(): string | undefined;
    /** Dispatch an outbound decision. proof-9: pre-handshake OR an unadvertised op is REFUSED,
     *  never attempted. Durable-first: persisted to the buffer BEFORE the transport send. */
    dispatch(op: string, entityBindingRef: string, payload: unknown, opts?: {
        decisionId?: string;
    }): DispatchResult;
    /** The connector Acked a decision — drain it from the durable buffer. */
    onAck(decisionId: string): void;
    /** On (re)connect: re-send every un-Acked decision (no-loss across a connector outage). */
    replayPending(): void;
}
//# sourceMappingURL=dispatcher.d.ts.map