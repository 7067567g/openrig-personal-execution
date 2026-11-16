import type { PackageManifest, SkillExport, GuidanceExport, AgentExport } from "./package-manifest.js";
export interface DeferredExport {
    exportType: "hook" | "mcp";
    source: string;
    reason: string;
}
export interface ResolvedExports {
    skills: SkillExport[];
    guidance: GuidanceExport[];
    agents: AgentExport[];
    deferred: DeferredExport[];
}
/**
 * Resolves package exports, optionally filtered by a role.
 * - When roleName is provided: filters skills/guidance to role references,
 *   keeps all agents, defers hooks referenced by role.
 * - When no roleName: returns all exports, defers all hooks/mcp.
 * - Context references are ignored (human-only docs).
 */
export declare function resolveExports(manifest: PackageManifest, roleName?: string): ResolvedExports;
//# sourceMappingURL=role-resolver.d.ts.map