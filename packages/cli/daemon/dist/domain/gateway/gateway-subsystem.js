// S10 (OPR.0.5.5.10) — the gateway as an IN-DAEMON SUBSYSTEM. M1 §3 as amended 2026-08-26
// (desk head-amendment under founder R2): the gateway runs in-process at daemon boot — the
// shipped components (GatewayDispatcher + DispatchBuffer) reused verbatim, NO child process,
// NO gateway↔connector socket wire. spawn-gateway.ts / gateway-process*.ts / transport.ts are
// the retired process-split shape and must not gain callers (second-deployable ABSENCE is a
// proof-contract red).
//
// Durability is the shipped contract, unchanged by the re-homing: a decision is persisted to
// the durable buffer BEFORE delivery is attempted (dispatcher enqueues first), drained ONLY
// after the delivery layer reports success (the in-process ack), and un-Acked decisions replay
// on every subsystem (re)start — a delivery failure is retained, never dropped.
//
// Failure honesty (mini-req 1): a wiring failure at start() surfaces as state=failed with the
// cause named, visible on the health surface — it never throws into daemon boot (a broken
// gateway must not take the daemon down) and never reads as silently active.
import { DispatchBuffer } from "./dispatch-buffer.js";
import { GatewayDispatcher } from "./dispatcher.js";
/** Compose the SHIPPED dispatcher + durable buffer in-process. The capability handshake
 *  becomes a local declaration by the delivery layer (same closed contract, no socket);
 *  ack-after-delivery becomes deliver() resolving ok. replayPending() at build time is the
 *  restart no-loss leg: un-Acked decisions from a prior run re-enter delivery. */
export function buildInProcessWire(opts) {
    const log = opts.log ?? (() => { });
    const buffer = new DispatchBuffer(opts.home);
    const deliverAndAck = async (decision) => {
        let outcome;
        try {
            outcome = await opts.deliver(decision);
        }
        catch (e) {
            outcome = { ok: false, class: "delivery-threw", detail: e.message };
        }
        if (outcome.ok) {
            dispatcher.onAck(decision.decisionId); // drain only after delivered
        }
        else {
            log(`delivery failed ${decision.decisionId} (${outcome.class}${outcome.detail ? ": " + outcome.detail : ""}) — retained for replay`);
        }
    };
    const dispatcher = new GatewayDispatcher({
        buffer,
        send: (decision) => { void deliverAndAck(decision); },
    });
    dispatcher.onCapability({
        kind: "capability",
        connectorId: opts.connectorId ?? "slack-subsystem",
        platform: opts.platform ?? "slack",
        protocolVersion: 1,
        ops: opts.ops ?? [],
    });
    return {
        dispatcher,
        stop: () => { },
        // Restart no-loss: un-Acked decisions re-enter delivery — a NETWORK action, so it rides
        // startServices() (post-bind), never wire composition.
        startServices: () => dispatcher.replayPending(),
    };
}
export class GatewaySubsystem {
    deps;
    state = "inactive";
    reason;
    activatedAt;
    wireHandle;
    servicesStarted = false;
    constructor(deps) {
        this.deps = deps;
    }
    /** Activate in-process. NEVER throws: a wiring failure records state=failed with the cause
     *  and returns — daemon boot proceeds and the health surface tells the truth. */
    start() {
        if (this.state === "active")
            return;
        try {
            this.wireHandle = this.deps.wire();
            this.state = "active";
            this.reason = undefined;
            this.activatedAt = (this.deps.now?.() ?? new Date()).toISOString();
            this.deps.log?.("gateway subsystem active (in-process)");
        }
        catch (e) {
            this.state = "failed";
            this.reason = e.message;
            this.wireHandle = undefined;
            this.deps.log?.(`gateway subsystem FAILED to activate: ${this.reason}`);
        }
    }
    /** Start the wire's network services (replay, pollers, sockets). Post-bind only — the
     *  index.ts supervision tree calls this beside contextMonitor.start(); test-built daemons
     *  never do, so composing a daemon never dials out. Idempotence is the wire's concern. */
    startServices() {
        if (this.state !== "active")
            return;
        try {
            this.wireHandle?.startServices?.();
            this.servicesStarted = true;
        }
        catch (e) {
            // Service startup failure is honest but NOT fatal to the composed wire: dispatches
            // still persist durably; the health surface names the degradation.
            this.reason = `services failed to start: ${e.message}`;
            this.deps.log?.(`gateway subsystem services FAILED to start: ${e.message}`);
        }
    }
    /** Dispatch through the live wire (refused honestly when not active).
     *  opts.decisionId: a caller-supplied durable episode-stable identity
     *  (OPR.0.5.6.1 — redrive idempotence for deferral fires and digest posts). */
    dispatch(op, entityBindingRef, payload, opts) {
        if (this.state !== "active" || !this.wireHandle) {
            return { ok: false, error: `dispatch refused: gateway subsystem is ${this.state}${this.reason ? ` (${this.reason})` : ""}` };
        }
        return this.wireHandle.dispatcher.dispatch(op, entityBindingRef, payload, opts);
    }
    /** Snapshot only: no dispatch-buffer scan, network or recovery work. The connector's
     *  status reads the inbound dead-letter files for the backlog count — a bounded,
     *  non-destructive read, no retry or recovery pass. */
    connectorStatus() {
        return { state: this.state, connector: this.wireHandle?.status?.() ?? null };
    }
    status() {
        const s = { state: this.state };
        if (this.reason !== undefined)
            s.reason = this.reason;
        if (this.activatedAt !== undefined)
            s.activatedAt = this.activatedAt;
        if (this.state === "active" || this.state === "failed") {
            try {
                s.pendingDispatches = new DispatchBuffer(this.deps.home).pending().length;
            }
            catch { /* buffer unreadable — omit rather than lie */ }
            const connector = this.wireHandle?.status?.();
            if (connector)
                s.connector = connector;
        }
        return s;
    }
    /** Recovery half of recovers-or-reports: tear down and re-run the wiring. If services were
     *  live (post-bind), the rebuilt wire's services start too — a config flip (enable/disable)
     *  lands without a daemon restart. */
    restart() {
        const resumeServices = this.servicesStarted;
        this.stop();
        this.state = "inactive";
        this.start();
        if (resumeServices)
            this.startServices();
    }
    stop() {
        try {
            this.wireHandle?.stop();
        }
        catch { /* best-effort */ }
        this.wireHandle = undefined;
        this.servicesStarted = false;
        if (this.state !== "failed")
            this.state = "stopped";
        this.deps.log?.("gateway subsystem stopped");
    }
}
//# sourceMappingURL=gateway-subsystem.js.map