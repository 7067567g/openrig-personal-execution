import type Database from "better-sqlite3";
import type { EventBus } from "../event-bus.js";
import type { QueueRepository, QueueItem } from "../queue-repository.js";
import { MissionControlActionLog, type MissionControlVerb } from "./mission-control-action-log.js";
export declare class MissionControlWriteContractError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, details?: Record<string, unknown> | undefined);
}
export interface MissionControlActionInput {
    verb: MissionControlVerb;
    qitemId: string;
    actorSession: string;
    /** P21 era-stamp: how actorSession was established. The route passes `transport:v1` (derived from
     *  the transport chokepoint); omitted/null ⇒ claimed-era, never re-labeled. Recorded on the audit row. */
    identityProvenance?: string | null;
    /** Required for `route` and `handoff`. */
    destinationSession?: string;
    /** Body for the new packet on `route`/`handoff`; defaults to source body. */
    body?: string;
    /** Required for `annotate`. */
    annotation?: string;
    /** Required for `hold` and `drop`; optional advisory text otherwise. */
    reason?: string;
    /** OPR.0.4.4.19 FR-7 — required for `resolve`: the human's non-empty
     *  decision text. Lands durably in queue_transitions.transition_note. */
    decision?: string;
    /** Operator-supplied audit context. */
    auditNotes?: Record<string, unknown>;
    /**
     * For handoff: opt-in best-effort wake. Default true (PL-004 Phase A R1
     * pattern: durable + waking by default; operators opt out for cold queues).
     * notify failure does NOT roll back durable state.
     */
    notify?: boolean;
}
export interface MissionControlActionResult {
    actionId: string;
    verb: MissionControlVerb;
    qitemId: string;
    closedQitem: QueueItem | null;
    createdQitemId: string | null;
    notifyAttempted: boolean;
    notifyResult: string | null;
    auditedAt: string;
}
interface WriteContractDeps {
    db: Database.Database;
    eventBus: EventBus;
    queueRepo: QueueRepository;
    actionLog: MissionControlActionLog;
    now?: () => Date;
}
export declare class MissionControlWriteContract {
    private readonly db;
    private readonly eventBus;
    private readonly queueRepo;
    private readonly actionLog;
    private readonly now;
    constructor(deps: WriteContractDeps);
    /**
     * Execute one verb. Atomic at the durable layer: queue mutation +
     * audit record + event persistence in one transaction. Post-commit:
     * notify subscribers + opt-in transport wake (handoff only).
     */
    act(input: MissionControlActionInput): Promise<MissionControlActionResult>;
    /**
     * Annotate has no queue mutation — only an audit record + event.
     * Still wrapped in a transaction so the audit + event are atomic.
     */
    private annotateOnly;
    /**
     * OPR.0.4.4.19 FR-7 — resolve + unpark (all six arch rails encoded):
     *
     *   1. A verb in the mission-control family (this method), NOT an overload
     *      of annotate/route.
     *   2. The decision text lands durably + queryably in
     *      queue_transitions.transition_note with actor_session = the
     *      resolving session (the composer reads it there forever).
     *   3. Unpark = blocked → in-progress via the Phase-A enum-validated
     *      update (no state-machine change) + the existing nudge machinery.
     *   4. Resolution routes BACK to the parked owner — the qitem keeps its
     *      destination; no new potato owner is ever created here.
     *   5. Enforcement symmetry: park required summary + evidence_ref;
     *      resolve requires NON-EMPTY decision text, daemon-enforced.
     *   6. The human acts on the surface/feed card; this is the ONE write
     *      path (POST /api/mission-control/action verb=resolve) — the CLI
     *      wrapper is a thin client of the same endpoint.
     *
     * NON-CLOSURE by contract: verbToClosure has NO resolve mapping — a
     * resolved qitem is state=in-progress with closure_reason still null.
     * One transaction: transition + decision note + audit row + events.
     * The owner nudge (carrying the decision text) is post-commit
     * best-effort — the unpark is never lost to a transport failure (BR-8).
     */
    private resolveParked;
    private requireMutableQitem;
}
export {};
//# sourceMappingURL=mission-control-write-contract.d.ts.map