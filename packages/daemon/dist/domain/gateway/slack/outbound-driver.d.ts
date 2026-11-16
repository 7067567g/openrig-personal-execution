import type { SeenStore } from "./state-store.js";
import type { AlertFilterOpts, OutboundQueuePort } from "./queue-access.js";
import type { DispatchResult } from "../dispatcher.js";
export declare const OUTBOUND_OP = "post_message";
/** The decision payload for op=post_message: the queue content the delivery layer renders.
 *  qitemId rides along as the idempotency anchor (seen-state key + the H reconcile marker). */
export interface OutboundPostPayload {
    qitemId: string;
    notificationKey?: string | null;
    ownerNotificationKind?: string | null;
    ownerNotificationLevel?: import("../../queue-transition-log.js").OwnerNotificationLevel | null;
    humanIntent?: "decision" | "update" | null;
    humanDetail?: string | null;
    /** #96: an update posted into this earlier qitem's thread (subsystem-resolved). */
    replyTo?: string | null;
    humanQuestions?: import("../../human-questions.js").HumanQuestion[] | null;
    summary?: string | null;
    body?: string | null;
    destinationSession?: string | null;
    sourceSession?: string | null;
    evidenceRef?: string | null;
    /** F: the loudness discriminators (interim rule: escalations mention, all else quiet). */
    tier?: string | null;
    tags?: string[] | null;
    /** #1013 — the row's state, so the renderer can tell a gate PARKED on a human
     *  (state=blocked) from the same row while an agent seat owns it. */
    state?: string | null;
}
export interface OutboundDriverDeps {
    home: string;
    queue: OutboundQueuePort;
    seen: SeenStore;
    filter: AlertFilterOpts;
    /** Dispatch into the subsystem wire (durable-first). Injected: the driver never posts itself. */
    dispatch: (op: string, entityBindingRef: string, payload: unknown) => DispatchResult;
    /** Called by the delivery layer's ack path? No — the WIRE acks; the driver learns success by
     *  the seen-store the delivery layer marks. This callback seam is for tests observing sweeps. */
    onSweep?: (result: SweepResult) => void;
    intervalMs?: number;
    log?: (msg: string) => void;
}
export interface SweepResult {
    alerts: number;
    fresh: number;
    dispatched: string[];
    refused: {
        qitemId: string;
        error: string;
    }[];
}
export declare class SlackOutboundDriver {
    private readonly deps;
    private readonly inflight;
    private timer;
    private sweeping;
    constructor(deps: OutboundDriverDeps);
    /** Seed inflight from the durable buffer (restart no-double-dispatch), then start the poll. */
    start(): void;
    /** One sweep: fresh = active human alerts minus seen minus inflight. Dispatch each. */
    sweepOnce(): Promise<SweepResult>;
    /** The delivery layer marked a qitem seen (delivered) — release the in-memory guard. */
    release(qitemId: string): void;
    stop(): void;
}
//# sourceMappingURL=outbound-driver.d.ts.map