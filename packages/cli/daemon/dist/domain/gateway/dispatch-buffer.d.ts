import type { OutboundDecision } from "./protocol.js";
export declare function dispatchBufferPath(home?: string): string;
/** The durable gateway dispatch buffer. Restart-surviving: `pending()` reads from disk.
 *  Idempotent on decisionId — enqueuing the same decisionId twice keeps ONE record. */
export declare class DispatchBuffer {
    private readonly path;
    constructor(home?: string);
    /** Persist a decision BEFORE dispatch (durable-first). Idempotent by decisionId. */
    enqueue(decision: OutboundDecision): void;
    /** Ack-gated DRAIN: remove a decision only once the connector has Acked it. */
    ack(decisionId: string): void;
    /** The un-Acked decisions (restart-surviving) — what a re-dispatch replays on recovery. */
    pending(): OutboundDecision[];
}
//# sourceMappingURL=dispatch-buffer.d.ts.map