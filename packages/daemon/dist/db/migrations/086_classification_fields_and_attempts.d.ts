import type { Migration } from "../migrate.js";
/**
 * 0.6.0 S02 P1: classification fields, result binding, and the attempt ledger.
 *
 * project_classifications (028) gains:
 * - four nullable label fields: area, scope_ref, duplicate_of_stream_item_id,
 *   needs_human (0/1; NULL = unknown, never false)
 * - result binding: lease_id plus the classifier, taxonomy and candidate-set
 *   versions the label was produced under
 * Rows written before 086 keep NULL in every new column; first-write-wins (the
 * UNIQUE stream_item_id) is unchanged.
 *
 * classification_attempts is the durable ledger for work that must NOT land in
 * the immutable classification row: abstentions, errors and in-flight attempts.
 * Identity is (stream_item_id, classifier_version, taxonomy_version,
 * evidence_epoch). An abstention is terminal only for that identity; a changed
 * version or evidence epoch is a new identity and makes the item eligible
 * again. Errors and abandoned in-flight attempts retry within a finite budget,
 * then end `exhausted`.
 *
 * execution_id fences each execution: every begin (first try, timeout reissue
 * or error retry) mints a new one, and only the current execution_id may finish
 * the attempt. A renewable lease never proves an older execution is dead.
 */
export declare const classificationFieldsAndAttemptsSchema: Migration;
//# sourceMappingURL=086_classification_fields_and_attempts.d.ts.map