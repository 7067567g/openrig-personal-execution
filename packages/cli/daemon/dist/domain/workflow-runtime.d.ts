import { type GuidanceInput } from "./workflow-guidance.js";
import { type ExceptionReadiness } from "./workflow-exception-readiness.js";
import { inspectGraph, reviseGraph } from "./workflow-reconciliation.js";
import { type LifecycleObligation } from "./lifecycle-obligations.js";
import type Database from "better-sqlite3";
import type { EventBus } from "./event-bus.js";
import type { QueueRepository } from "./queue-repository.js";
import { WorkflowInstanceStore, WorkflowInstanceError } from "./workflow-instance-store.js";
import { type ExceptionRoute } from "./workflow-exception-router.js";
import type { WorkflowHumanDestination } from "./workflow-human-destination.js";
import type { WorkflowExceptionClass } from "./workflow-exception.js";
import { WorkflowProjector, WorkflowProjectorError, type ProjectStepInput, type ProjectStepResult } from "./workflow-projector.js";
import { WorkflowSpecCache, WorkflowSpecError } from "./workflow-spec-cache.js";
import { WorkflowStepTrailLog } from "./workflow-step-trail-log.js";
import { type SeatLivenessCheckFn, type ValidationResult, WorkflowValidator } from "./workflow-validator.js";
import type { WatchdogJobsRepository } from "./watchdog-jobs-repository.js";
import { type WorkflowDeadlineVerdict } from "./workflow-deadline.js";
import type { WorkflowFailureOccurrence, WorkflowInstance, WorkflowSpecRow, WorkflowStepSpec, WorkflowStepTrailEntry } from "./workflow-types.js";
import { type WorkflowScope } from "./workflow-scope.js";
import { type LifecycleCompilation } from "./project-lifecycle-compiler.js";
export interface WorkflowRuntimeDeps {
    guidanceLibrary?: GuidanceInput["library"];
    db: Database.Database;
    eventBus: EventBus;
    queueRepo: QueueRepository;
    now?: () => Date;
    /**
     * OPR.0.4.6.WF1 FR-3: when supplied, instantiate + handoff
     * projections auto-arm the per-instance workflow-keepalive watchdog
     * job INSIDE the scribe transaction, and terminal exits disarm it.
     * Optional so tests / embedders without the watchdog subsystem keep
     * working; startup wires the real repository.
     */
    watchdogJobsRepo?: WatchdogJobsRepository;
    /**
     * OPR.0.4.6.WF5 FR-2: the maturity-dial inputs (injected at startup —
     * the projector never reads config itself). hostDefault is read LIVE
     * per exception; absent = the orchestrator-first engine default with
     * registered-human selection when no agent route resolves.
     */
    exceptionDial?: {
        hostDefault: () => "orchestrator" | "human_only" | null;
        humanFallbackSeat: WorkflowHumanDestination;
    };
}
export interface InstantiateInput {
    specPath: string;
    rootObjective: string;
    createdBySession: string;
    /**
     * Override default entry-step owner. v1 falls back to spec
     * preferred_targets[0] for the entry step's role.
     */
    entryOwnerSession?: string;
    /**
     * OPR.0.4.6.FAC1 (AC-1): the rig this instance binds to. Overrides
     * the spec's `target.rig` DEFAULT; the effective binding
     * (`targetRig ?? spec.target.rig ?? null`) persists as
     * `WorkflowInstance.boundRig` and scopes role-capability resolution.
     * Absent AND no spec default = unbound (today's behavior).
     */
    targetRig?: string;
    /**
     * The project / mission / slice (and free-form tags) this instance works
     * for. Normalized here (a reserved or contradicting tag throws
     * WorkflowScopeError before any write), stored on the instance, and stamped
     * on every packet it creates. A lifecycle instance takes project and mission
     * from its compiled identity instead.
     */
    scope?: Pick<WorkflowScope, "project" | "mission" | "slice" | "tags">;
    lifecycle?: {
        operationKey: string;
        compiledInputDigest: string;
        binding: Record<string, unknown>;
    };
    /** Internal generated input from compileLifecycle; never accepted from a client. */
    compiledLifecycle?: LifecycleCompilation;
}
export interface InstantiateResult {
    instance: WorkflowInstance;
    spec: WorkflowSpecRow;
    entryQitemId: string;
    entryOwnerSession: string;
    /**
     * OPR.0.4.6.FAC1 (arch ruling 2026-07-07, target-rig zero-regression):
     * loud instantiate-time advisories. Non-fatal notices the operator MUST
     * see. TWO producers into this one list: (1) the spec-default degrade —
     * when a spec's `target.rig` DEFAULT (provenance = spec author's hint,
     * not an operator `--rig` demand) names an unregistered rig, the
     * instance degrades to UNBOUND (routes via preferred_targets,
     * byte-identical pre-FAC-1) with an advisory here rather than a
     * hard-fail; (2) the OPR.0.4.6.FAC3 member-exists probe — a declared
     * preferred_target naming a registered rig but a nonexistent member.
     * Always present (empty when nothing to say); route + CLI surface it
     * loudly.
     */
    advisories: string[];
    replayed?: boolean;
}
export declare class WorkflowRuntime {
    readonly specCache: WorkflowSpecCache;
    readonly instanceStore: WorkflowInstanceStore;
    readonly trailLog: WorkflowStepTrailLog;
    readonly validator: WorkflowValidator;
    readonly projector: WorkflowProjector;
    private readonly guidanceLibrary?;
    private readonly db;
    private readonly eventBus;
    private readonly queueRepo;
    private readonly now;
    private readonly watchdogJobsRepo;
    private readonly exceptionDial?;
    constructor(deps: WorkflowRuntimeDeps);
    inspectGraph(instanceId: string): import("./workflow-reconciliation.js").GraphReconciliation;
    recoverOperation(key: string): {
        kind: string;
        receipt: Record<string, unknown>;
        instance: WorkflowInstance;
    } | null;
    reviseGraph(input: Parameters<typeof reviseGraph>[2]): {
        replayed: boolean;
        kind: string;
        receipt: Record<string, unknown>;
        instance: WorkflowInstance;
    };
    compileLifecycle(missionPath: string, operationKey?: string): LifecycleCompilation & {
        exceptionReadiness?: ExceptionReadiness;
    };
    private readExceptionReadiness;
    guidance(instanceId: string, options?: Pick<GuidanceInput, "packetId" | "component" | "full">): {
        stories?: {
            address: string;
            text: string;
        }[] | undefined;
        components?: {
            id: string;
            owner?: string;
            admission?: string;
        }[] | undefined;
        edges?: {
            from: string;
            to: string;
            when?: string;
        }[] | undefined;
        teaching?: ({
            id: string;
            owner?: string;
            admission?: string;
        } & {
            address: string;
            text: string;
        })[] | undefined;
        state: string;
        selectionSource: string | null;
        catalogSource: string | null;
        catalogPath: string | null;
        catalogHash: string | null;
        sources: {
            kind: string;
            path: string;
            sha256: string;
            binding: "matches-bound" | "differs-from-bound" | "not-bound";
        }[];
        position: string;
        ownerSession: string | null;
        unknowns: string[];
        expansionCommand: string;
        lines: string[];
    };
    exceptionReadiness(instanceId: string): ExceptionReadiness | null;
    exceptionObligations(instanceId: string): {
        qitemId: string;
        ownerSession: string;
        state: "done" | "denied" | "failed" | "pending" | "canceled" | "in-progress" | "blocked" | "handed-off";
        evidenceRef: string | null;
        tags: string[] | null;
        handedOffFrom: string | null;
        inspectCommand: string;
    }[];
    instantiateLifecycle(input: {
        missionPath: string;
        operationKey: string;
        rootObjective: string;
        createdBySession: string;
        entryOwnerSession?: string;
        targetRig?: string;
    }): Promise<InstantiateResult & {
        compilation: LifecycleCompilation;
    }>;
    /**
     * OPR.0.4.6.WF5 FR-2: resolve the maturity dial for a CACHED spec —
     * the class-(b) detection paths (sweep/keepalive) call this through
     * the startup-injected closure. null = spec not cached (the caller's
     * registered-human selection applies). Uses the SAME preferred_targets[0]
     * string-pick as step-owner resolution (arch Seam-A uniformity).
     */
    resolveExceptionRouteFor(workflowName: string, workflowVersion: string, exceptionClass: WorkflowExceptionClass, 
    /** OPR.0.4.6.FAC1 (arch Q3): the instance's bound rig — dial
     *  position 3 (orchestrator-role) then resolves capability-aware
     *  on that rig when the role declares no preferred_targets.
     *  Absent/null = the shipped fleet-blind string-pick only. */
    boundRig?: string | null): ExceptionRoute | null;
    /**
     * OPR.0.4.6.WF2 FR-3: the production host-registry probe for the
     * validator — built on the daemon hosts-registry reader (read-only
     * twin of the CLI registry). An unreadable/missing registry reports
     * every id as unregistered with an empty id list (fail-loud at the
     * validator's host_not_registered issue, never a silent pass).
     */
    private hostRegistryLookup;
    /** P19 A4 (finding graduated): the runtime OWNS the default liveness probe —
     *  the hostRegistryLookup sibling precedent. A preferred target is live iff a
     *  session with that exact name is currently `running` in this daemon's DB.
     *  Callers may still inject a custom check (tests, remote-aware futures). */
    private seatLivenessCheck;
    validate(specPath: string, seatLivenessCheck?: SeatLivenessCheckFn): ValidationResult & {
        exceptionReadiness: ExceptionReadiness;
    };
    /**
     * Create a workflow instance + first-step qitem. The entry qitem is
     * created in the same transaction as the instance row; subscribers
     * see the workflow.instantiated + queue.created events together.
     */
    instantiate(input: InstantiateInput): Promise<InstantiateResult>;
    project(input: ProjectStepInput): Promise<ProjectStepResult>;
    /** Recheck each recorded overdue packet, never a sibling's verdict. The
     * decision and closure share a transaction; boot repairs a crash after project. */
    reconcileStuckExceptions(instanceId?: string): number;
    inspect(instanceId: string): {
        instance: WorkflowInstance;
        frontier: Array<{
            packetId: string;
            stepId: string | null;
            ownerSession: string | null;
            queueState: string | null;
            blockedOn: string | null;
            targetedAction: "project" | "route" | "indeterminate";
            dependsOn: string[];
            gate: WorkflowStepSpec["gate"] | null;
            acceptance: WorkflowStepSpec["acceptance"] | null;
            receiptRequired: boolean;
            deadline: WorkflowDeadlineVerdict;
            waiting: import("./queue-waiting.js").WaitingView | null;
        }>;
        failures: Array<WorkflowFailureOccurrence & {
            targetedAction: "resume" | "none";
        }>;
        unknowns: string[];
        boundaryObligations: LifecycleObligation[];
    };
    abort(input: {
        instanceId: string;
        reason: string;
        actorSession: string;
    }): Promise<{
        instanceId: string;
        closedPacketIds: string[];
        status: "aborted";
    }>;
    /**
     * OPR.0.4.6.WF3 FR-4 — `route`: re-target the CURRENT FRONTIER step
     * of a live instance to a new owner. THE ADJUDICATED MECHANISM
     * (arch, formal, on the advance-authority ground): CLOSE + RECREATE
     * + FRONTIER REBIND in ONE scribe transaction. Revocation is
     * STRUCTURAL: the old packet leaves the frontier inside this txn, so
     * a zombie old owner's stale `project` hits the shipped
     * `packet_not_on_frontier` 409 — zero new validation machinery on
     * the hot advance path (the weighed-and-rejected alternative).
     *
     * The observable contract (PRD FR-4 (1)-(8)):
     *   (1) owner = target after route      (5) frontier non-dangling
     *   (2) current_step_id UNCHANGED       (6) additive event detail
     *   (3) actor+reason+old→new durable    (7) pin + version guard held
     *   (4) NO forged completion closure    (8) zombie structurally 409'd
     * Route is NOT an advance: hop_count does not bump (max_hops counts
     * steps, not re-targets); BR-3 — `project` stays the sole advance.
     */
    /**
     * OPR.0.4.6.WF5 FR-4 — RESUME from where it stopped (redrive
     * semantics, the one engine extension). One scribe transaction:
     * failed → active REBOUND to the failed step, a FRESH frontier packet
     * to the step's RE-RESOLVED owner, the trail preserved and extended
     * (completed steps never re-run), the livelock rail re-baselined
     * (hops-since-resume — exactly one more bounded window), the redrive
     * count recorded, open exception items for THIS occurrence closed
     * (resolve+resume closes the occurrence; a later re-failure is a NEW
     * occurrence), keepalive re-armed, additive workflow.resumed event.
     *
     * THE ARCH PIN (plan Rev-2, binding): the owner is RE-RESOLVED
     * through the SAME resolution path projection uses
     * (resolveDefaultOwner — preferred_targets + harness reconciliation),
     * NEVER copied from the closed packet's recorded destination: a dead
     * seat is a common CAUSE of the exception, and resume is the one
     * sanctioned re-resolution point (FAC-1 R1) the binding layer later
     * upgrades uniformly.
     */
    resume(input: {
        instanceId: string;
        occurrenceId?: string;
        decision?: string;
        actorSession: string;
    }): Promise<{
        instanceId: string;
        stepId: string;
        newPacketId: string;
        ownerSession: string;
        resumeCount: number;
        exceptionItemsClosed: number;
        absorbedReplay?: boolean;
    }>;
    /** Called inside the redrive transaction; only this instance's failed packet is resolved. */
    private closeFailureExceptions;
    private resumeFailureOccurrence;
    route(input: {
        instanceId: string;
        packetId?: string;
        toSession: string;
        actorSession: string;
        reason?: string;
    }): Promise<{
        instanceId: string;
        stepId: string | null;
        closedPacketId: string;
        newPacketId: string;
        fromSession: string;
        toSession: string;
        instanceStatus: WorkflowInstance["status"];
    }>;
    /**
     * Continue: idempotent inspector for the current frontier of an
     * instance. v1 is read-only — returns the current state. POC's
     * mechanical advance is folded into project() for v1; continue() is
     * the audit/inspect entrypoint.
     */
    continue(instanceId: string): {
        instance: WorkflowInstanceWithDeadline;
        trail: WorkflowStepTrailEntry[];
        guidance: ReturnType<WorkflowRuntime["guidance"]>;
        reconciliation: ReturnType<typeof inspectGraph>;
        frontier: ReturnType<WorkflowRuntime["inspect"]>["frontier"];
        failures: ReturnType<WorkflowRuntime["inspect"]>["failures"];
        unknowns: string[];
        boundaryObligations: LifecycleObligation[];
    };
    /**
     * OPR.0.4.6.WF1 FR-2 COMPLETION FIXBACK (build-vs-ratified-AC debt,
     * qitem-20260706211220-279039f5): the ratified FR-2 AC requires the
     * stuck classification to be "queryable via list/show/trace … with
     * the evidence (step, owner, deadline, age)". The merged WF-1 build
     * surfaced it only through the boot sweep + keepalive nudges; this
     * closes the queryability clause by deriving the SAME evaluator
     * verdict (one threshold home — workflow-deadline.ts) at read time.
     *
     * DERIVED, NEVER STORED: recomputed per read from (instance,
     * frontier packets, now) — a normal re-projection self-clears it,
     * exactly like every other evaluator consumer. Exposes the FULL
     * classification tuple (state + evidence{step, owner, anchor,
     * anchorAt, overdueBySeconds, ageSeconds}) so BOTH consumers (WF-3's
     * status rollup and WF-5's FR-3 ▲ source) read one shape — no
     * boolean flattening, no second path.
     */
    deadlineFor(instance: WorkflowInstance): WorkflowDeadlineVerdict;
    /** The additive read enrichment consumed by list/show/trace routes. */
    withDeadline(instance: WorkflowInstance): WorkflowInstanceWithDeadline;
    /** List instances (optionally filtered) with the deadline verdict attached. */
    listInstancesWithDeadline(status?: "active" | "waiting" | "completed" | "failed" | "aborted"): WorkflowInstanceWithInspection[];
}
/** WorkflowInstance + the derived FR-2 deadline verdict (additive read shape). */
export type WorkflowInstanceWithDeadline = WorkflowInstance & {
    deadline: WorkflowDeadlineVerdict;
};
export type WorkflowInstanceWithInspection = WorkflowInstanceWithDeadline & {
    frontierPackets: ReturnType<WorkflowRuntime["inspect"]>["frontier"];
    failureOccurrences: ReturnType<WorkflowRuntime["inspect"]>["failures"];
    boundaryObligations: LifecycleObligation[];
    unknowns: string[];
};
export { WorkflowInstanceError, WorkflowProjectorError, WorkflowSpecError, };
//# sourceMappingURL=workflow-runtime.d.ts.map