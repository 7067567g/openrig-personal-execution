import type { LegacyRigSpec, RigSpec, ValidationResult, WorkspaceSpec } from "./types.js";
export declare const VALID_EDGE_KINDS: Set<string>;
/** SPEC-VALIDATION CAPABILITY REGISTRY (B8-family, r2-ruled expiry coupling). Behavioral sentinel,
 *  not a filename: a validation feature that other code must react to REGISTERS itself here, and
 *  consumers gate on the capability. Current contract (desk ruling 05:03Z): the 5.3
 *  spec-validation ADVISORY, when it lands model-pin canonicalization, MUST add
 *  "model-pin-canonicalization" — that single line mechanically kills the claude alias migration
 *  bridge at runtime AND turns its pin test red until the bridge constant is deleted. */
export declare const SPEC_VALIDATION_CAPABILITIES: ReadonlySet<string>;
/**
 * Pod-aware RigSpec validator. Canonical contract for the AgentSpec reboot.
 */
export declare class RigSpecSchema {
    /**
     * Validate a parsed rig spec object. Collects all errors.
     * @param raw - parsed YAML object
     * @returns validation result
     */
    static validate(raw: unknown, opts?: {
        externalQualifiedIds?: Iterable<string>;
    }): ValidationResult;
    /**
     * Normalize a validated rig spec into the canonical typed shape.
     * @param raw - parsed YAML object (must pass validation first)
     * @returns normalized RigSpec
     */
    static normalize(raw: Record<string, unknown>): RigSpec;
    /** Validate only a RigSpec workspace block through the canonical schema. */
    static validateWorkspace(raw: unknown): ValidationResult;
    /** Normalize only a validated RigSpec workspace block. */
    static normalizeWorkspace(raw: unknown): WorkspaceSpec | undefined;
}
export declare class LegacyRigSpecSchema {
    static validate(raw: unknown): ValidationResult;
    static normalize(raw: unknown): LegacyRigSpec;
}
//# sourceMappingURL=rigspec-schema.d.ts.map