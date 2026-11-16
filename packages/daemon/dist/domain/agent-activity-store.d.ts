import type Database from "better-sqlite3";
import type { EventBus } from "./event-bus.js";
import type { AgentActivity, PersistedEvent } from "./types.js";
export declare const AGENT_ACTIVITY_FRESHNESS_MS: number;
export interface HookActivityInput {
    turnId?: string | null;
    runtime: string | null;
    sessionName?: string | null;
    nodeId?: string | null;
    hookEvent: string;
    subtype?: string | null;
    occurredAt?: string | null;
    /** W2a-1 — the EMITTING occupant's generation, CARRIED source-bound on the hook (the producer/relay
     *  supplies it at fire time; the route ingests it). NOT inferred from record-time state — that
     *  inference mis-attributes a delayed prior-occupant hook to the live occupant. Absent on a legacy,
     *  excluded, or no-tenure emitting path ⇒ stamped null ⇒ unresolved at read (never false-fresh). */
    generation?: string | null;
}
export type RecordHookActivityResult = {
    ok: true;
    activity: AgentActivity;
    event: PersistedEvent;
} | {
    ok: false;
    code: "missing_session_identity" | "session_not_found";
    error: string;
};
interface AgentActivityStoreDeps {
    db: Database.Database;
    eventBus: EventBus;
    now?: () => Date;
    freshnessMs?: number;
    /** W2a-1 — resolve the LIVE occupant generation for a node (the shipped occupant-tenure
     *  generation_uuid), or null when UNKNOWN. Injected (not self-constructed) so the store stays
     *  decoupled from SessionRegistry and unit-testable with a fake. When ABSENT the store applies no
     *  generation gate — legacy clock-only freshness — so the existing callers are unchanged until the
     *  producer wiring injects the real resolver. Resolution is SYNCHRONOUS (a better-sqlite3 read),
     *  which is why the gate lives inline in the sync read path with no signature churn to 9 callers. */
    resolveOccupantGeneration?: (nodeId: string) => string | null;
    /** Confirm that a carried generation is registered for this node. A side-effect-free reservation
     * that never committed must remain unresolvable, not become positive mismatch evidence. */
    isRegisteredOccupantGeneration?: (nodeId: string, generation: string) => boolean;
}
export declare class AgentActivityStore {
    readonly db: Database.Database;
    private readonly eventBus;
    private readonly now;
    /** The window within which a stored hook counts as recent (read-only for diagnostics). */
    readonly freshnessMs: number;
    private readonly resolveOccupantGeneration?;
    private readonly isRegisteredOccupantGeneration?;
    constructor(deps: AgentActivityStoreDeps);
    recordHookEvent(input: HookActivityInput): RecordHookActivityResult;
    getLatestForNode(input: {
        nodeId?: string | null;
        sessionName?: string | null;
        now?: Date;
    }): AgentActivity | null;
    /** W2a-1 — the dead-tenure verdict: the claim's occupant generation is REGISTERED FOR THIS NODE and
     *  DIFFERENT from the live generation. The membership gate runs before this helper, so an uncommitted
     *  reservation can never manufacture a positive dead-tenure finding.
     *  It must not be honored as the live seat. Returns unknown + `generation_mismatch`,
     *  stale:true (detection fires), provenance `resolved` (both generations WERE resolved — they simply
     *  differ). This is the ONLY generation case that abstains; a null on either side is UNRESOLVED
     *  provenance and is DELIVERED labelled, never routed here. */
    private generationMismatch;
    /** W2a-1 — the UNRESOLVABLE-provenance verdict (ABSENCE of evidence, not a dead-tenure finding).
     *  State UNKNOWN + a distinct reason + stale:true so no consumer reads it as verified-live (fresh is
     *  a positive liveness claim). The STORE delivers the row carrying generationProvenance:"unresolved"
     *  at the ACTIVITY layer; turning that label into a still-flowing CONSUMER row is the tap FOLLOW-ON
     *  (verify-demotion, qitem-20260808183747-f7f04662) — the unchanged tap still discards it in the
     *  INTERIM (a bounded regression, mint-race-transient exposure; mm2 has no occupant_tenures table
     *  until 0.5.1). Kept DISTINCT from generationMismatch: ignorance and evidence get different verdicts,
     *  and the paths must not collapse — at the store now, and at the tap when the follow-on lands. */
    private generationUnresolved;
    /** W2a-1 — the resolver-EXCEPTION verdict: the live-generation resolver threw (a transient ledger/db
     *  fault). DEGRADE to unknown + a DISTINCT reason (`generation_resolver_error`) + stale:true, so the
     *  read never crashes and the claim is never rendered fresh; provenance `unresolved`. Kept separate
     *  from a clean null (unresolvable) so a resolver FAULT is distinguishable from an honest ABSENCE. */
    private generationDegraded;
    resolveSession(input: {
        sessionName?: string | null;
        nodeId?: string | null;
        runtime?: string | null;
    }): {
        sessionId: string;
        rigId: string;
        nodeId: string;
        sessionName: string;
        runtime: string | null;
    } | null;
    private _resolveSession;
}
/** The activity a runtime hook event means, before freshness or generation checks. The one mapping behind
 *  ingest, the send gate and the wake ladder. `seatRuntime` is the managed seat's runtime: runtime_error is
 *  an OMP runner signal, and a hook claiming OMP on another runtime's seat must not escalate it. */
export declare function hookEventState(rawEvent: string | null | undefined, rawSubtype: string | null | undefined, seatRuntime: string | null): AgentActivity["state"];
/** A runtime hook that leaves the agent waiting on a person: an approval, a picker or an elicitation. */
export declare function hookMeansNeedsInput(rawEvent: string | null | undefined, rawSubtype: string | null | undefined, seatRuntime: string | null): boolean;
/** The store's latest hook still says the seat waits on a person. Nothing newer was recorded, so nothing
 *  answered it. Shared by the send gate and the wake ladder. */
export declare function latestHookWaitsOnPerson(activity: AgentActivity | null | undefined, seatRuntime: string | null): boolean;
export declare function latestHookPermissionPending(activity: AgentActivity | null | undefined, seatRuntime: string | null): boolean;
/** The store's latest hook shows the seat moved on after `since`: observed after it, generation-valid, and
 *  meaning work started or the turn ended. Older, absent, mismatched or unknown evidence does not. */
export declare function latestHookMovedOn(activity: AgentActivity | null | undefined, since: string, seatRuntime: string | null): boolean;
export {};
//# sourceMappingURL=agent-activity-store.d.ts.map