import type Database from "better-sqlite3";
import { type WorkflowScope } from "./workflow-scope.js";
import type { WorkflowFailureOccurrence, WorkflowFrontierBinding, WorkflowInstance, WorkflowInstanceStatus } from "./workflow-types.js";
/** Defensive column probe (the detectQueueColumn house pattern) —
 *  older test fixtures bypass the canonical migration list, so the
 *  version column (migration 049) may be absent; the guard degrades
 *  to legacy unguarded updates there. Production always migrates. */
export declare function detectInstanceColumn(db: Database.Database, columnName: string, opts?: {
    strict?: boolean;
}): boolean;
export interface CreateWorkflowInstanceInput {
    workflowName: string;
    workflowVersion: string;
    createdBySession: string;
    initialFrontier?: string[];
    /** R2: durable current-step binding set at instantiate time. */
    currentStepId?: string;
    /**
     * OPR.0.4.6.FAC1: the rig NAME this instance binds to (already
     * resolved by the runtime: targetRig override ?? spec.target.rig).
     * null/absent = unbound (today's behavior byte-identical).
     */
    boundRig?: string | null;
    /** Already-normalized scope (workflow-scope.ts); null/absent = unscoped. */
    scope?: WorkflowScope | null;
    lifecycle?: {
        operationKey: string;
        compiledInputDigest: string;
        binding: Record<string, unknown>;
    };
}
export declare class WorkflowInstanceError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, details?: Record<string, unknown> | undefined);
}
export declare class WorkflowInstanceStore {
    private readonly db;
    private readonly now;
    private readonly hasVersionColumn;
    private readonly hasResumeColumns;
    private readonly hasBoundRigColumn;
    private readonly hasLifecycleColumns;
    private readonly hasScopeColumn;
    private readonly hasFrontierBindingsTable;
    private readonly hasFailureOccurrencesTable;
    constructor(db: Database.Database, now?: () => Date);
    create(input: CreateWorkflowInstanceInput): WorkflowInstance;
    getById(instanceId: string): WorkflowInstance | null;
    getByIdOrThrow(instanceId: string): WorkflowInstance;
    getByLifecycleOperationKey(operationKey: string): WorkflowInstance | null;
    /** Caller wraps cache/binding/receipt/event in one transaction. No packet or trail is rewritten. */
    reviseLifecycle(instanceId: string, expectedVersion: number, workflowVersion: string, digest: string, binding: Record<string, unknown>): void;
    bindFrontierPacket(input: {
        instanceId: string;
        packetId: string;
        stepId: string;
        branchDrive?: number;
        hopCount?: number;
        hopsBaseline?: number;
    }): WorkflowFrontierBinding;
    removeFrontierBinding(instanceId: string, packetId: string): void;
    getFrontierBinding(instanceId: string, packetId: string): WorkflowFrontierBinding | null;
    listFrontierBindings(instanceId: string): WorkflowFrontierBinding[];
    recordFailureOccurrence(input: {
        instanceId: string;
        failedPacketId: string;
        stepId: string;
        branchDrive?: number;
        hopCount?: number;
        hopsBaseline?: number;
        failureReason?: string | null;
    }): WorkflowFailureOccurrence;
    getFailureOccurrence(instanceId: string, occurrenceId: string): WorkflowFailureOccurrence | null;
    listFailureOccurrences(instanceId: string, status?: "unresolved" | "resolved"): WorkflowFailureOccurrence[];
    resolveFailureOccurrence(instanceId: string, occurrenceId: string, redrivePacketId: string, resumeDecision?: string): void;
    listByStatus(status: WorkflowInstanceStatus): WorkflowInstance[];
    listAll(): WorkflowInstance[];
    /**
     * Update frontier + status atomically. Caller is responsible for
     * wrapping in a transaction when this needs to compose with other
     * mutations (e.g., workflow-projector folds this into the
     * close + create + frontier-update transaction).
     */
    updateFrontier(instanceId: string, nextFrontier: string[], nextStatus: WorkflowInstanceStatus, opts?: {
        bumpHopCount?: boolean;
        lastContinuationDecision?: Record<string, unknown> | null;
        fallbackSynthesis?: string | null;
        completedAt?: string | null;
        /**
         * R2: explicit next current_step_id. When provided, OVERWRITES
         * the column (including to NULL by passing the empty string for
         * "clear"). When omitted, current_step_id is preserved (the
         * frontier packet is reused, e.g., on waiting). To clear pass
         * the symbol "clear-current-step" (typed as the literal below).
         */
        currentStepId?: string | "preserve" | "clear";
        /**
         * OPR.0.4.6.WF1 FR-5 — the optimistic-concurrency guard. When
         * provided, the UPDATE is qualified `WHERE version = ?` and bumps
         * `version = version + 1`; zero rows changed throws the
         * structured `instance_version_conflict` naming expected/actual
         * (the caller's transaction rolls back whole). When omitted,
         * legacy unguarded behavior (no version read, no bump) — the
         * projector ALWAYS provides it.
         */
        expectedVersion?: number;
        /**
         * OPR.0.4.6.WF5 FR-4 — the resume stamp: sets the recorded
         * redrive count AND the livelock-rail hops baseline atomically
         * with the frontier rebind. Only resume() passes it.
         */
        resumeStamp?: {
            resumeCount: number;
            hopsBaseline: number;
        };
    }): void;
}
//# sourceMappingURL=workflow-instance-store.d.ts.map