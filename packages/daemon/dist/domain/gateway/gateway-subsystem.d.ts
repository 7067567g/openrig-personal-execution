import { GatewayDispatcher, type DispatchResult } from "./dispatcher.js";
import type { OutboundDecision } from "./protocol.js";
/** The in-process delivery outcome (mirrors the retired connector's DeliveryOutcome shape so
 *  the slice-11 delivery semantics carry over verbatim at cutover). */
export type SubsystemDeliveryOutcome = {
    ok: true;
} | {
    ok: false;
    class: string;
    detail?: string;
};
export type SubsystemDeliverFn = (decision: OutboundDecision) => Promise<SubsystemDeliveryOutcome>;
/** What a wiring step yields: the live dispatcher, its teardown, and (optionally) the
 *  NETWORK-TOUCHING services (replay, outbound poll, socket inbound). Services start only via
 *  startServices() — invoked POST-BIND from index.ts (the contextMonitor pattern), so a
 *  test-built daemon (createDaemon without serve) composes the wire but never dials out. */
export interface GatewayWire {
    dispatcher: GatewayDispatcher;
    stop(): void;
    startServices?(): void;
    status?(): Record<string, unknown>;
}
export interface InProcessWireOpts {
    home: string;
    /** The platform delivery seam. Until the relay cutover wires Slack, startup passes an
     *  honest unwired refusal — dispatches are retained durably, never silently dropped. */
    deliver: SubsystemDeliverFn;
    /** Ops the delivery layer advertises. The shipped proof-9 rail holds in-process: an
     *  unadvertised op is refused, never attempted. Empty = nothing dispatchable yet. */
    ops?: string[];
    connectorId?: string;
    platform?: string;
    log?: (msg: string) => void;
}
/** Compose the SHIPPED dispatcher + durable buffer in-process. The capability handshake
 *  becomes a local declaration by the delivery layer (same closed contract, no socket);
 *  ack-after-delivery becomes deliver() resolving ok. replayPending() at build time is the
 *  restart no-loss leg: un-Acked decisions from a prior run re-enter delivery. */
export declare function buildInProcessWire(opts: InProcessWireOpts): GatewayWire;
export type GatewaySubsystemState = "inactive" | "active" | "failed" | "stopped";
export interface GatewaySubsystemStatus {
    state: GatewaySubsystemState;
    /** Present iff state=failed: the named cause (honest failure, never a silent dead gateway). */
    reason?: string;
    activatedAt?: string;
    /** Durable un-delivered decisions awaiting delivery/replay (undefined until first start). */
    pendingDispatches?: number;
    /** Connector-owned live observations; never inferred when the wire has none. */
    connector?: Record<string, unknown>;
}
export interface GatewaySubsystemDeps {
    home: string;
    /** The wiring step. Production: () => buildInProcessWire({...}). Injectable so tests can
     *  induce a wiring failure and pin the honest-failure contract. */
    wire: () => GatewayWire;
    log?: (msg: string) => void;
    now?: () => Date;
}
export declare class GatewaySubsystem {
    private readonly deps;
    private state;
    private reason;
    private activatedAt;
    private wireHandle;
    private servicesStarted;
    constructor(deps: GatewaySubsystemDeps);
    /** Activate in-process. NEVER throws: a wiring failure records state=failed with the cause
     *  and returns — daemon boot proceeds and the health surface tells the truth. */
    start(): void;
    /** Start the wire's network services (replay, pollers, sockets). Post-bind only — the
     *  index.ts supervision tree calls this beside contextMonitor.start(); test-built daemons
     *  never do, so composing a daemon never dials out. Idempotence is the wire's concern. */
    startServices(): void;
    /** Dispatch through the live wire (refused honestly when not active).
     *  opts.decisionId: a caller-supplied durable episode-stable identity
     *  (OPR.0.5.6.1 — redrive idempotence for deferral fires and digest posts). */
    dispatch(op: string, entityBindingRef: string, payload: unknown, opts?: {
        decisionId?: string;
    }): DispatchResult;
    /** Snapshot only: no dispatch-buffer scan, network or recovery work. The connector's
     *  status reads the inbound dead-letter files for the backlog count — a bounded,
     *  non-destructive read, no retry or recovery pass. */
    connectorStatus(): Record<string, unknown>;
    status(): GatewaySubsystemStatus;
    /** Recovery half of recovers-or-reports: tear down and re-run the wiring. If services were
     *  live (post-bind), the rebuilt wire's services start too — a config flip (enable/disable)
     *  lands without a daemon restart. */
    restart(): void;
    stop(): void;
}
//# sourceMappingURL=gateway-subsystem.d.ts.map