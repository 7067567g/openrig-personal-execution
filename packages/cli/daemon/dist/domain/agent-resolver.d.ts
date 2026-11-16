import type { AgentSpec } from "./types.js";
export interface AgentResolverFsOps {
    readFile(path: string): string;
    exists(path: string): boolean;
}
export interface ResolvedAgentSpec {
    spec: AgentSpec;
    sourcePath: string;
    hash: string;
}
export interface ResourceCollision {
    category: string;
    resourceId: string;
    sources: Array<{
        specName: string;
        qualifiedId: string;
    }>;
}
export interface ShippableSubstanceSource {
    path: string;
    bytes: string | Uint8Array;
}
export type ResolveResult = {
    ok: true;
    resolved: ResolvedAgentSpec;
    imports: ResolvedAgentSpec[];
    collisions: ResourceCollision[];
} | {
    ok: false;
    code: "not_found";
    error: string;
} | {
    ok: false;
    code: "parse_error";
    error: string;
} | {
    ok: false;
    code: "validation_failed";
    errors: string[];
} | {
    ok: false;
    code: "version_mismatch";
    error: string;
} | {
    ok: false;
    code: "import_error";
    error: string;
    importRef: string;
} | {
    ok: false;
    code: "cycle_detected";
    error: string;
};
/**
 * Resolve an agent_ref to a concrete AgentSpec, including flat imports.
 * @param ref - agent_ref string (e.g. "local:agents/impl" or "path:/abs/agents/impl")
 * @param rigRoot - absolute path to rig root directory
 * @param fsOps - injectable filesystem operations
 * @returns structured resolve result
 */
export declare function resolveAgentRef(ref: string, rigRoot: string, fsOps: AgentResolverFsOps): ResolveResult;
/**
 * Resolve imports for an already-loaded AgentSpec.
 * Import local: refs resolve relative to the spec's own directory.
 * @param resolved - already-resolved base spec
 * @param fsOps - injectable filesystem operations
 * @returns structured resolve result with imports and collisions
 */
export declare function resolveImports(resolved: ResolvedAgentSpec, fsOps: AgentResolverFsOps): ResolveResult;
/**
 * Deterministic refusal floor for content crossing a public artifact boundary.
 * The broader generic-vs-instance call remains a human judgment recorded by
 * the substance-gate receipt; this helper only enforces the two classes whose
 * answer is structural: private shared-docs paths and taxonomy: lore.
 */
export declare function assertShippableSubstance(sources: readonly ShippableSubstanceSource[]): void;
//# sourceMappingURL=agent-resolver.d.ts.map