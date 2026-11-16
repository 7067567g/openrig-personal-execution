import { type GuidanceInput } from "./workflow-guidance.js";
import type Database from "better-sqlite3";
import type { EventBus } from "./event-bus.js";
import type { QueueRepository } from "./queue-repository.js";
import type { WorkflowInstanceStore } from "./workflow-instance-store.js";
import type { WorkflowSpecCache } from "./workflow-spec-cache.js";
import type { WorkflowStepTrailLog } from "./workflow-step-trail-log.js";
import type { WorkflowExitKind, WorkflowInstance, WorkflowSpec, WorkflowStepSpec } from "./workflow-types.js";
import { type RoleResolutionContext } from "./workflow-role-context.js";
import { type WorkflowHumanDestination } from "./workflow-human-destination.js";
import type { WatchdogJobsRepository } from "./watchdog-jobs-repository.js";
/** One occurrence-bound action, shared by packet bodies and authored wait wakes. */
export declare function renderWorkflowProjectCommand(input: {
    instanceId: string;
    packetId: string;
    ownerSession: string;
    step?: Pick<WorkflowStepSpec, "acceptance">;
}): string;
/** Refreshes guidance when a packet is recreated (route/resume) instead of
 * carrying a stale packet id or owner forward in copied body text. */
export declare function withWorkflowContinuation(input: {
    body: string;
    contextRefs?: string[];
    binding?: GuidanceInput["binding"];
    library?: GuidanceInput["library"];
    instanceId: string;
    packetId: string;
    ownerSession: string;
    step?: Pick<WorkflowStepSpec, "acceptance"> & {
        id?: string;
    };
}): string;
export declare function workflowWaitWakeMessage(input: {
    spec: WorkflowSpec;
    instance: WorkflowInstance;
    step: WorkflowStepSpec;
    packetId: string;
    ownerSession: string;
}): string;
/**
 * OPR.0.4.6.WF2 FR-2: canonical-session → node runtime column lookup
 * (the harness-pin reconciliation source). Latest session row wins
 * (the node-inventory join discipline). null = not a managed node.
 * Shared by the projector (projection-time pins) and the runtime
 * facade (instantiate-time static pin checks).
 */
export declare function nodeRuntimeOf(db: Database.Database, session: string): string | null;
export declare class WorkflowProjectorError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, details?: Record<string, unknown> | undefined);
}
export interface ProjectStepInput {
    instanceId: string;
    /** The qitem being closed (must be in instance.currentFrontier). */
    currentPacketId: string;
    /** What kind of exit closes this packet. */
    exit: WorkflowExitKind;
    /** Free-form closure result text (POC: --result). */
    resultNote?: string;
    /** For waiting exits: the blocker reference (qitem id, gate name). */
    blockedOn?: string;
    /** Operator-supplied evidence for the closure record (audit). */
    closureEvidence?: Record<string, unknown>;
    /** Session that closed the packet (owner-as-author). */
    actorSession: string;
    /**
     * Optional explicit override for the next-step destination session.
     * When omitted, the projector resolves from the next step's
     * actor_role + role.preferred_targets[]. Required when no
     * preferred_targets are declared OR none are operator-resolvable.
     */
    nextOwnerSession?: string;
}
export interface ProjectStepResult {
    instance: WorkflowInstance;
    closurePriorPacketId: string;
    closureReason: WorkflowExitKind;
    /** null on terminal closures (waiting / done / failed / no-successor). */
    nextQitemId: string | null;
    /** null on terminal closures. */
    nextOwnerSession: string | null;
    /** null on terminal closures. */
    nextStepId: string | null;
    /** All packets/steps projected by a dependency-graph advance. */
    nextQitemIds?: string[];
    nextStepIds?: string[];
    /** Composite fired events (step_closed + optional next_qitem_projected + optional completed). */
    emittedEventTypes: string[];
    /**
     * OPR.0.4.6.WF1 FR-5: true when this call was an ABSORBED
     * waiting-replay — an exact full-closure-intent duplicate of the
     * stored decision. Zero writes happened; the stored first outcome is
     * what this result reflects.
     */
    absorbedReplay?: boolean;
}
export declare class WorkflowProjector {
    private readonly db;
    private readonly eventBus;
    private readonly queueRepo;
    private readonly instanceStore;
    private readonly trailLog;
    private readonly specCache;
    private readonly now;
    /** OPR.0.4.6.WF1 FR-3: optional — arms/disarms packet or legacy-instance keepalives in-txn. */
    private readonly watchdogJobsRepo?;
    /** OPR.0.4.6.WF5 FR-2: the maturity-dial inputs, injected at startup
     *  (the validateRig precedent — the projector never reads config
     *  itself). hostDefault is read LIVE per exception (dial flips apply
     *  to future items only). Absent = engine defaults (orchestrator-
     *  first chain with registered-human selection). */
    private readonly exceptionDial?;
    private readonly guidanceLibrary?;
    constructor(db: Database.Database, eventBus: EventBus, queueRepo: QueueRepository, instanceStore: WorkflowInstanceStore, trailLog: WorkflowStepTrailLog, specCache: WorkflowSpecCache, now?: () => Date, 
    /** OPR.0.4.6.WF1 FR-3: optional — arms/disarms packet or legacy-instance keepalives in-txn. */
    watchdogJobsRepo?: WatchdogJobsRepository | undefined, 
    /** OPR.0.4.6.WF5 FR-2: the maturity-dial inputs, injected at startup
     *  (the validateRig precedent — the projector never reads config
     *  itself). hostDefault is read LIVE per exception (dial flips apply
     *  to future items only). Absent = engine defaults (orchestrator-
     *  first chain with registered-human selection). */
    exceptionDial?: {
        hostDefault: () => "orchestrator" | "human_only" | null;
        humanFallbackSeat: WorkflowHumanDestination;
    } | undefined, guidanceLibrary?: GuidanceInput["library"]);
    private nodeRuntimeOf;
    /**
     * Close the current packet AND create/project the next-step packet
     * IN THE SAME TRANSACTION. The load-bearing transactional-scribe
     * call site.
     */
    project(input: ProjectStepInput): Promise<ProjectStepResult>;
    /** Failure, owning task and wake commit together on both executor paths.
     * Caller invokes only for an unhandled failure, never mapped remediation. */
    private admitFailureException;
    private projectDependencyGraph;
}
/**
 * Resolve the next step. OPR.0.4.6.WF2 FR-1: when a `recordedExit` is
 * supplied AND the step's `next_hop.on` maps it, the MAPPED target wins
 * (the deterministic branch — same (spec, step, exit) → same target,
 * every time). Otherwise the structural default: the spec-authored
 * `next_hop.suggested_roles` edge, then declaration order.
 *
 * EXPORTED (OPR.0.4.6.WF1 FR-7): this is THE single routing seam —
 * the validator's reachability/cycle analysis runs over these exact
 * semantics (never a parallel re-implementation). The validator calls
 * it WITHOUT an exit for the structural default path and unions the
 * branch edges explicitly — one routing truth, no semantic fork.
 */
export declare function resolveNextStep(spec: WorkflowSpec, currentStep: WorkflowStepSpec, recordedExit?: WorkflowExitKind): WorkflowStepSpec | null;
/**
 * Resolve a default owner for a step. v1 picks the first declared
 * preferred_target. OPR.0.4.6.WF2 FR-2: a step with a `harness:` pin
 * picks the first preferred_target whose node runtime matches the pin
 * instead; no match is a STRUCTURED routing failure naming the pin and
 * each candidate's actual runtime — never a silent mis-route to the
 * wrong harness. `runtimeOf` resolves a canonical session name to its
 * node's runtime column (null = not a managed node / unknown).
 *
 * OPR.0.4.6.FAC1: gains the optional bound-rig context — see the tier
 * comment in the body. Tier order (P2-6, guard-BLOCKING on deviation):
 *   1. explicit input.nextOwnerSession (caller-reconciled)
 *   2. gate compile (the caller branches there first)
 *   3. declared preferred_targets — TODAY'S path byte-for-byte
 *   4. NEW: role capability on the bound rig (no targets + bound only)
 *   5. null → the shipped next_owner_unresolved at the caller.
 *
 * Returns null only for the unpinned no-targets UNBOUND case (caller
 * must supply nextOwnerSession explicitly — unchanged v1 behavior).
 */
export declare function resolveDefaultOwner(spec: WorkflowSpec, step: WorkflowStepSpec, runtimeOf?: (session: string) => string | null, 
/** OPR.0.4.6.FAC1: the bound-rig resolution context. Present only for
 *  BOUND instances at LIVE resolution sites (projection next-step,
 *  gate compile, entry, resume) — never at the eager instantiate loop
 *  (guard B1: no eager live resolution of future steps). */
roleCtx?: RoleResolutionContext): string | null;
/**
 * OPR.0.4.6.WF2 FR-2: reconcile an EXPLICIT owner override against a
 * step's harness pin. An operator-supplied owner whose runtime does not
 * match the pin is rejected loud — an explicit override must never
 * silently defeat a declared pin.
 */
export declare function reconcileExplicitOwnerHarness(step: WorkflowStepSpec, explicitOwner: string, runtimeOf: (session: string) => string | null): void;
/**
 * OPR.0.4.6.WF2 FR-5: the gate compiler — a declared step-level gate
 * resolves to LIVE 0.4.4 machinery by target kind. HUMAN target (the
 * shipped human-seat predicate) → a human-routed item (tier
 * `human-gate`) carrying the summary + evidence_ref the shipped write
 * path enforces, resolved by the shipped `resolve` verb. HANDLER-ROLE
 * target → an ordinary agent-routed item to the declared role's
 * resolved seat (no human-only enforcement fields forced on it). WF-2
 * builds the socket; WF-5 owns gate SEMANTICS.
 */
export interface GateCompileResult {
    destinationSession: string;
    /** Reserved for a future tier override; undefined = caller's default tier. */
    tier: string | undefined;
    summary: string | null;
    evidenceRef: string | null;
    kind: "human" | "handler-role";
    /** HUMAN targets: the human seat the packet parks blocked_on (the leg-1
     *  park the shipped `rig queue resolve` verb acts on — guard blocker 1:
     *  resolve requires state=blocked + human-seat blocked_on, so the gate
     *  item is created for the STEP OWNER and parked on the human, never
     *  minted as an unresolvable pending human-destined item). null for
     *  handler-role gates (ordinary agent routing, no park-on-human). */
    parkOn: string | null;
}
export declare function compileGate(spec: WorkflowSpec, gatedStep: WorkflowStepSpec, runtimeOf: (session: string) => string | null, 
/** OPR.0.4.6.FAC1: bound-rig context — threads capability resolution
 *  into BOTH gate paths (guard B3: the human-gate OWNER path and the
 *  handler-role DESTINATION branch are different code paths and each
 *  must carry it). Absent = shipped behavior byte-identical. */
roleCtx?: RoleResolutionContext): GateCompileResult;
//# sourceMappingURL=workflow-projector.d.ts.map