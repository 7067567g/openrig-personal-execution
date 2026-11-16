import { type OperatorContextMode, type OperatorContextModeRecord } from "./rig-mode-types.js";
/**
 * The 10 required fields of an OperatorContextModeRecord. Used by
 * validateRecord to enumerate field-set integrity (HG-2) — both
 * presence and exhaustiveness.
 *
 * NOTE: `mode` is NOT in this list. Mode is the binding selector
 * (Component 2 vocabulary), not part of the Component-3 settings
 * record. The store/route validate mode separately at the binding
 * boundary; this validator enforces only the 10 Component-3 fields.
 */
export declare const REQUIRED_RECORD_FIELDS: readonly (keyof OperatorContextModeRecord)[];
export interface ValidationOk {
    ok: true;
    record: OperatorContextModeRecord;
}
export interface ValidationError {
    ok: false;
    errors: string[];
}
export type ValidationResult = ValidationOk | ValidationError;
/**
 * Validate a candidate record against the FROZEN contract. Returns
 * the typed record on success OR a list of 3-part error messages on
 * failure (one per offending field; report all at once so an
 * operator doesn't have to retry per error).
 *
 * Strict: any field outside REQUIRED_RECORD_FIELDS is rejected
 * (HG-2 — field-set integrity; "no merged/dropped fields").
 */
export declare function validateRecord(raw: unknown): ValidationResult;
/**
 * Validate an operator-supplied mode name. Mode lives outside the
 * 10-field record (Component 2 vocabulary, not Component 3 settings).
 * The route + store call this at the binding boundary; the
 * disambiguator below (for invocation parsing) is separate.
 */
export declare function validateModeName(raw: unknown): {
    ok: true;
    mode: OperatorContextMode;
} | {
    ok: false;
    error: string;
};
/**
 * Disambiguate operator-supplied mode input. Per convention §Component 4
 * "Bare-Word Disambiguation":
 *
 * - A bare word that is one of the six reserved modes → invocation
 * - An explicit `mode:` prefix → invocation
 * - A word embedded in a sentence → NOT invocation (caller treats as topic)
 *
 * Returns the canonical mode name when the input is unambiguously an
 * invocation; null otherwise. Caller emits a clarification question
 * for null+bare-multi-word inputs (per convention "ask once").
 */
export declare function disambiguateModeInvocation(rawInput: string): OperatorContextMode | null;
//# sourceMappingURL=rig-mode-validator.d.ts.map