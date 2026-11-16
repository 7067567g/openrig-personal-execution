import type { IdentityProvenance } from "../routes/require-sender-identity.js";
import type Database from "better-sqlite3";
import type { EventBus } from "./event-bus.js";
import type { ClassifierLeaseManager } from "./classifier-lease-manager.js";
/**
 * Project classifier (PL-004 Phase B; L2 Project / Classifier — write path).
 * 0.6.0 S02 P1: results bind to a lease id and are validated inside the write
 * transaction; four nullable label fields and version bindings (migration 086).
 *
 * Per PRD § L2 + slice IMPL § Guard Checkpoint Focus item 1+2+4:
 * - Lease validation via classifier-lease-manager (single-writer contract).
 * - Idempotency via UNIQUE constraint on stream_item_id (re-projection → 409).
 * - Daemon does NOT enforce taxonomies on classification fields — those are
 *   agent-authoritative. Daemon only owns the
 *   contract (lease + idempotency + reclaim).
 * - Emits project.classified event after the row is committed.
 *
 * Pattern mirrors Phase A's stream-store.ts shape (single class, atomic
 * transactions, persist-event-then-notify). No Hono.
 */
export interface ProjectClassification {
    projectId: string;
    streamItemId: string;
    classificationType: string | null;
    classificationUrgency: string | null;
    classificationMaturity: string | null;
    classificationConfidence: string | null;
    classificationDestination: string | null;
    action: string | null;
    /** 0.6.0 S02 fields (migration 086). NULL = unknown; rows before 086 are NULL. */
    area: string | null;
    scopeRef: string | null;
    duplicateOfStreamItemId: string | null;
    /** true / false only when the classifier stated it; null = unknown, never false. */
    needsHuman: boolean | null;
    /** Result binding (086): the lease and versions the label was produced under. */
    leaseId: string | null;
    classifierVersion: string | null;
    taxonomyVersion: string | null;
    candidateSetVersion: string | null;
    classifierSession: string;
    tsProjected: string;
    identityProvenance: IdentityProvenance | null;
}
export interface ProjectClassifyInput {
    identityProvenance?: IdentityProvenance;
    streamItemId: string;
    classifierSession: string;
    /** Required (S02 P1): the lease this result was computed under. */
    leaseId: string;
    /**
     * Optional attempt-ledger binding; marked `written` in the same transaction.
     * Omit it for a manual classification (not ledger-bound).
     */
    attemptId?: string;
    /** Required with attemptId: the executionId from the begin() that produced this result. */
    executionId?: string;
    classificationType?: string;
    classificationUrgency?: string;
    classificationMaturity?: string;
    classificationConfidence?: string;
    classificationDestination?: string;
    action?: string;
    area?: string;
    scopeRef?: string;
    duplicateOfStreamItemId?: string;
    needsHuman?: boolean | null;
    classifierVersion?: string;
    taxonomyVersion?: string;
    candidateSetVersion?: string;
}
export interface ProjectListOptions {
    classifierSession?: string;
    classificationDestination?: string;
    area?: string;
    scopeRef?: string;
    /** "true" | "false" | "unknown" (NULL). */
    needsHuman?: "true" | "false" | "unknown";
    limit?: number;
}
export declare class ProjectClassifierError extends Error {
    readonly code: string;
    readonly meta: Record<string, unknown> | undefined;
    constructor(code: string, message: string, meta?: Record<string, unknown>);
}
export declare class ProjectClassifier {
    readonly db: Database.Database;
    private readonly eventBus;
    private readonly leaseManager;
    private readonly now;
    constructor(db: Database.Database, eventBus: EventBus, leaseManager: ClassifierLeaseManager, opts?: {
        now?: () => Date;
    });
    /**
     * Project a stream item — agent-authored classification, daemon-enforced
     * idempotency + lease.
     *
     * 1. Verify the caller holds the active lease (delegates to leaseManager).
     * 2. INSERT project_classifications row (UNIQUE on stream_item_id catches
     *    re-projection attempts; we map the constraint violation to a clean
     *    `idempotency_violation` error).
     * 3. Emit project.classified event.
     */
    classify(input: ProjectClassifyInput): ProjectClassification;
    private streamItemExists;
    /**
     * The attempt must be in flight under THIS lease, for THIS item and the same
     * classifier/taxonomy versions the result claims. Marked `written` inside the
     * classify transaction, so the ledger and the row can never disagree.
     */
    private bindAttemptWritten;
    getById(projectId: string): ProjectClassification | null;
    getByStreamItemId(streamItemId: string): ProjectClassification | null;
    list(opts?: ProjectListOptions): ProjectClassification[];
    private getByIdOrThrow;
    private rowToProject;
}
//# sourceMappingURL=project-classifier.d.ts.map