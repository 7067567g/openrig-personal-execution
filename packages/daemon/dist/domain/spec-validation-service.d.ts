import type { ValidationResult } from "./types.js";
/** Only parser failures are client input errors; validator exceptions remain internal failures. */
export declare class RigSpecParseError extends Error {
}
/** Shared CLI/import validation with a distinct parser-error boundary. */
export declare function validateRigSpecImport(yaml: string): ValidationResult;
/**
 * Validate an AgentSpec from raw YAML text.
 * No filesystem access, no side effects.
 * @param yaml - raw agent.yaml content
 * @returns validation result
 */
export declare function validateAgentSpecFromYaml(yaml: string): {
    valid: boolean;
    errors: string[];
};
/**
 * Validate a pod-aware RigSpec from raw YAML text.
 * No filesystem access, no side effects.
 * @param yaml - raw rig.yaml content
 * @returns validation result
 */
export declare function validateRigSpecFromYaml(yaml: string): {
    valid: boolean;
    errors: string[];
};
//# sourceMappingURL=spec-validation-service.d.ts.map