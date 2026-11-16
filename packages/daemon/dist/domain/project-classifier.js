import { ulid } from "ulid";
export class ProjectClassifierError extends Error {
    code;
    meta;
    constructor(code, message, meta) {
        super(message);
        this.code = code;
        this.meta = meta;
    }
}
export class ProjectClassifier {
    db;
    eventBus;
    leaseManager;
    now;
    constructor(db, eventBus, leaseManager, opts) {
        this.db = db;
        this.eventBus = eventBus;
        this.leaseManager = leaseManager;
        this.now = opts?.now ?? (() => new Date());
    }
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
    classify(input) {
        validateClassifyInput(input);
        const projectId = ulid();
        const tsProjected = this.now().toISOString();
        // S02 P1: every check that decides whether this result may be written runs
        // INSIDE the write transaction, so a lease replaced or expired between the
        // check and the insert cannot let a late result through.
        const txn = this.db.transaction(() => {
            // Lease: active, same session, same lease id, not expired.
            this.leaseManager.requireActiveHolder(input.classifierSession, input.leaseId);
            // R1 fix (BLOCKER 1): existence check on stream_item_id. The L1→L2
            // FK in migration 028 is a defense-in-depth safety net, but the SQLite
            // FK violation would surface as an opaque error string. Pre-checking
            // here gives a clean structured error (`unknown_stream_item`) that
            // routes can map to a 400-class status.
            if (!this.streamItemExists(input.streamItemId)) {
                throw new ProjectClassifierError("unknown_stream_item", `stream_item_id ${input.streamItemId} does not exist in stream_items; emit it first via 'rig stream emit' or check the id`, { streamItemId: input.streamItemId });
            }
            if (input.duplicateOfStreamItemId !== undefined && !this.streamItemExists(input.duplicateOfStreamItemId)) {
                throw new ProjectClassifierError("invalid_duplicate_of", `duplicateOfStreamItemId ${input.duplicateOfStreamItemId} does not exist in stream_items`, { duplicateOfStreamItemId: input.duplicateOfStreamItemId });
            }
            // First-write-wins (unchanged): a second classify is a clean 409.
            const existing = this.db
                .prepare(`SELECT * FROM project_classifications WHERE stream_item_id = ?`)
                .get(input.streamItemId);
            if (existing) {
                throw new ProjectClassifierError("idempotency_violation", `stream_item_id ${input.streamItemId} is already projected as project_id ${existing.project_id} by ${existing.classifier_session}`, { existingProjectId: existing.project_id, existingClassifier: existing.classifier_session });
            }
            if (input.attemptId !== undefined)
                this.bindAttemptWritten(input);
            this.db
                .prepare(`INSERT INTO project_classifications (
            project_id, stream_item_id,
            classification_type, classification_urgency, classification_maturity,
            classification_confidence, classification_destination, action,
            area, scope_ref, duplicate_of_stream_item_id, needs_human,
            lease_id, classifier_version, taxonomy_version, candidate_set_version,
            classifier_session, ts_projected, identity_provenance
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(projectId, input.streamItemId, input.classificationType ?? null, input.classificationUrgency ?? null, input.classificationMaturity ?? null, input.classificationConfidence ?? null, input.classificationDestination ?? null, input.action ?? null, input.area ?? null, input.scopeRef ?? null, input.duplicateOfStreamItemId ?? null, input.needsHuman === true ? 1 : input.needsHuman === false ? 0 : null, input.leaseId, input.classifierVersion ?? null, input.taxonomyVersion ?? null, input.candidateSetVersion ?? null, input.classifierSession, tsProjected, input.identityProvenance ?? null);
            return this.eventBus.persistWithinTransaction({
                type: "project.classified",
                projectId,
                streamItemId: input.streamItemId,
                classifierSession: input.classifierSession,
                classificationType: input.classificationType ?? null,
                classificationDestination: input.classificationDestination ?? null,
            });
        });
        const persisted = txn();
        this.eventBus.notifySubscribers(persisted);
        return this.getByIdOrThrow(projectId);
    }
    streamItemExists(streamItemId) {
        return this.db.prepare(`SELECT 1 FROM stream_items WHERE stream_item_id = ? LIMIT 1`).get(streamItemId) !== undefined;
    }
    /**
     * The attempt must be in flight under THIS lease, for THIS item and the same
     * classifier/taxonomy versions the result claims. Marked `written` inside the
     * classify transaction, so the ledger and the row can never disagree.
     */
    bindAttemptWritten(input) {
        const attempt = this.db
            .prepare(`SELECT * FROM classification_attempts WHERE attempt_id = ?`)
            .get(input.attemptId);
        if (attempt && attempt.execution_id !== input.executionId) {
            throw new ProjectClassifierError("attempt_superseded", "this execution was superseded by a newer execution of the attempt", {
                attemptId: input.attemptId,
            });
        }
        if (!attempt ||
            attempt.status !== "in_flight" ||
            attempt.lease_id !== input.leaseId ||
            attempt.stream_item_id !== input.streamItemId ||
            attempt.classifier_version !== input.classifierVersion ||
            attempt.taxonomy_version !== input.taxonomyVersion) {
            throw new ProjectClassifierError("attempt_mismatch", "attemptId is not in flight for this item, lease and versions", {
                attemptId: input.attemptId,
                attemptStatus: attempt?.status ?? null,
            });
        }
        this.db
            .prepare(`UPDATE classification_attempts SET status = 'written', retry_after = NULL, updated_at = ? WHERE attempt_id = ?`)
            .run(this.now().toISOString(), attempt.attempt_id);
    }
    getById(projectId) {
        const row = this.db
            .prepare(`SELECT * FROM project_classifications WHERE project_id = ?`)
            .get(projectId);
        return row ? this.rowToProject(row) : null;
    }
    getByStreamItemId(streamItemId) {
        const row = this.db
            .prepare(`SELECT * FROM project_classifications WHERE stream_item_id = ?`)
            .get(streamItemId);
        return row ? this.rowToProject(row) : null;
    }
    list(opts) {
        const limit = opts?.limit ?? 100;
        const conditions = [];
        const params = [];
        if (opts?.classifierSession) {
            conditions.push("classifier_session = ?");
            params.push(opts.classifierSession);
        }
        if (opts?.classificationDestination) {
            conditions.push("classification_destination = ?");
            params.push(opts.classificationDestination);
        }
        if (opts?.area) {
            conditions.push("area = ?");
            params.push(opts.area);
        }
        if (opts?.scopeRef) {
            conditions.push("scope_ref = ?");
            params.push(opts.scopeRef);
        }
        if (opts?.needsHuman === "true")
            conditions.push("needs_human = 1");
        else if (opts?.needsHuman === "false")
            conditions.push("needs_human = 0");
        else if (opts?.needsHuman === "unknown")
            conditions.push("needs_human IS NULL");
        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        params.push(limit);
        const rows = this.db
            .prepare(`SELECT * FROM project_classifications ${where} ORDER BY ts_projected DESC LIMIT ?`)
            .all(...params);
        return rows.map((r) => this.rowToProject(r));
    }
    getByIdOrThrow(projectId) {
        const p = this.getById(projectId);
        if (!p) {
            throw new ProjectClassifierError("project_not_found", `project ${projectId} not found after write`);
        }
        return p;
    }
    rowToProject(row) {
        return {
            projectId: row.project_id,
            streamItemId: row.stream_item_id,
            classificationType: row.classification_type,
            classificationUrgency: row.classification_urgency,
            classificationMaturity: row.classification_maturity,
            classificationConfidence: row.classification_confidence,
            classificationDestination: row.classification_destination,
            action: row.action,
            area: row.area ?? null,
            scopeRef: row.scope_ref ?? null,
            duplicateOfStreamItemId: row.duplicate_of_stream_item_id ?? null,
            needsHuman: row.needs_human === 1 ? true : row.needs_human === 0 ? false : null,
            leaseId: row.lease_id ?? null,
            classifierVersion: row.classifier_version ?? null,
            taxonomyVersion: row.taxonomy_version ?? null,
            candidateSetVersion: row.candidate_set_version ?? null,
            classifierSession: row.classifier_session,
            tsProjected: row.ts_projected,
            identityProvenance: row.identity_provenance ?? null,
        };
    }
}
/** Consumed optional string fields: a string when supplied, never null/number/object. */
const OPTIONAL_STRING_FIELDS = [
    "attemptId", "executionId",
    "classificationType", "classificationUrgency", "classificationMaturity",
    "classificationConfidence", "classificationDestination", "action",
    "area", "scopeRef", "duplicateOfStreamItemId",
    "classifierVersion", "taxonomyVersion", "candidateSetVersion",
];
/** IDs and versions must also be non-blank; free-text label fields may be any string. */
const NON_BLANK_FIELDS = new Set([
    "attemptId", "executionId", "scopeRef", "duplicateOfStreamItemId",
    "classifierVersion", "taxonomyVersion", "candidateSetVersion",
]);
/**
 * Shape checks for consumed fields only (S02 P1). Label VALUES stay
 * agent-authoritative; the daemon checks what code relies on, before any SQL.
 * String-or-omitted everywhere except needsHuman (boolean, null = unknown, or omitted).
 */
function validateClassifyInput(input) {
    const raw = input;
    if (input.identityProvenance !== undefined && !["transport:v1", "relay:v1", "claimed:v1", "origin-unknown:v1"].includes(input.identityProvenance)) {
        throw new ProjectClassifierError("invalid_field", "unknown identity provenance", { field: "identityProvenance" });
    }
    for (const field of ["streamItemId", "classifierSession"]) {
        if (typeof raw[field] !== "string" || raw[field].trim() === "") {
            throw new ProjectClassifierError("invalid_field", `${field} must be a non-empty string`, { field });
        }
    }
    if (typeof input.leaseId !== "string" || input.leaseId.trim() === "") {
        throw new ProjectClassifierError("lease_id_required", "leaseId is required: bind the result to the lease it was computed under (rig project lease-acquire returns it)");
    }
    for (const field of OPTIONAL_STRING_FIELDS) {
        const value = raw[field];
        if (value === undefined)
            continue;
        if (typeof value !== "string" || (NON_BLANK_FIELDS.has(field) && value.trim() === "")) {
            throw new ProjectClassifierError("invalid_field", `${field} must be ${NON_BLANK_FIELDS.has(field) ? "a non-empty string" : "a string"} when supplied`, { field });
        }
    }
    if (input.needsHuman !== undefined && input.needsHuman !== null && typeof input.needsHuman !== "boolean") {
        throw new ProjectClassifierError("invalid_needs_human", "needsHuman must be true, false or null (unknown)");
    }
    if (input.duplicateOfStreamItemId !== undefined && input.duplicateOfStreamItemId === input.streamItemId) {
        throw new ProjectClassifierError("invalid_duplicate_of", "an item cannot be a duplicate of itself");
    }
    if (input.scopeRef !== undefined && !input.candidateSetVersion) {
        throw new ProjectClassifierError("candidate_set_version_required", "scopeRef must be bound to the scope candidate-set version it was chosen from");
    }
    if (input.attemptId !== undefined && (!input.classifierVersion || !input.taxonomyVersion)) {
        throw new ProjectClassifierError("attempt_versions_required", "a result bound to an attemptId must carry classifierVersion and taxonomyVersion");
    }
    if (input.attemptId !== undefined && input.executionId === undefined) {
        throw new ProjectClassifierError("execution_id_required", "a result bound to an attemptId must carry the executionId returned by its begin()");
    }
}
//# sourceMappingURL=project-classifier.js.map