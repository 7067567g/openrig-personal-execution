import type { AgentSpec, ValidationResult } from "./types.js";
/** Canonical form of a compaction strategy: new values pass through, deprecated aliases
 *  map, anything else is null. The ONE vocabulary site — resolvers import this rather
 *  than re-encoding the set (one-shared-resolution-path). */
export declare function canonicalCompactionStrategy(value: string): string | null;
/** One ingestion authority for the continuity mechanic address. */
export declare function canonicalContinuityMechanic(value: unknown): string | null;
/**
 * Parse raw YAML text into an untyped object.
 * @param yamlText - raw YAML content of agent.yaml
 * @returns parsed object
 */
export declare function parseAgentSpec(yamlText: string): Record<string, unknown>;
/**
 * Validate a parsed AgentSpec object. Collects all errors.
 * @param raw - parsed YAML object
 * @returns validation result with all errors
 */
export declare function validateAgentSpec(raw: unknown): ValidationResult;
/**
 * Normalize a validated AgentSpec into the canonical typed shape.
 * Applies defaults for optional fields.
 * @param raw - parsed YAML object (must pass validation first)
 * @returns normalized AgentSpec
 */
export declare function normalizeAgentSpec(raw: Record<string, unknown>): AgentSpec;
//# sourceMappingURL=agent-manifest.d.ts.map