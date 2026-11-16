import { type OmittedCounts, type OmittedRecordClass } from "./types.js";
import { hasSecretPattern } from "./redaction.js";
/** Source-runtime-agnostic record classifier output. */
export type ClassifyResult = {
    kind: "kept";
} | {
    kind: "omitted";
    reason: OmittedRecordClass;
};
/**
 * Classify a Codex JSONL record (the parsed JSON object) into kept /
 * omitted. Caller is responsible for passing only `response_item`-class
 * records; session_meta and compacted are handled separately by the
 * Codex parser.
 *
 * Codex semantics (per Velocity prior art):
 * - response_item with payload.type === "function_call" → function_call_output
 * - response_item with payload.type === "custom_tool_call" → raw_tool_outputs
 * - response_item with payload.type === "reasoning" → reasoning_records
 * - response_item with payload.type === "message" + role in {developer,user,assistant}
 *   → kept (after secret-pattern check)
 * - everything else → reasoning_records (catch-all for non-message non-tool
 *   payload types)
 */
export declare function classifyCodexRecord(record: {
    payload?: {
        type?: unknown;
        role?: unknown;
    };
}): ClassifyResult;
/**
 * Classify a Claude transcript record. Claude shape carries the role
 * directly at `record.type` (user / assistant / system / attachment /
 * summary etc). Per the M2b dispatch's "emit the same structured
 * representation as the Codex parser" requirement, the omitted-class
 * mapping mirrors Codex.
 */
export declare function classifyClaudeRecord(record: {
    type?: unknown;
}): ClassifyResult;
/** State holder for accumulating omitted-class counts during parsing. */
export declare class OmittedCounter {
    readonly counts: OmittedCounts;
    recordOmission(reason: OmittedRecordClass): void;
    /**
     * Mark that a kept message had secret content (was redacted). Increments
     * `redacted_secrets` per occurrence. Caller checks `hasSecretPattern`
     * BEFORE redaction to decide whether to record this.
     */
    recordRedaction(): void;
    /**
     * Returns the list of omitted classes that have at least one record.
     * Used to populate `summary.omitted_classes` per contract § 5.
     * Order: stable (the enum order from the type definition).
     */
    activeClasses(): OmittedRecordClass[];
}
/** Re-export for convenience. */
export { hasSecretPattern };
//# sourceMappingURL=omitted-records.d.ts.map