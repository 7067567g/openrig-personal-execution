import type { ProjectionClassification } from "./projection-planner.js";
import type { FsOps } from "./package-resolver.js";
import type { InstallPlan, InstallPlanEntry } from "./install-planner.js";
export interface RefinedInstallPlan extends InstallPlan {
    noOps: InstallPlanEntry[];
}
export interface GuidanceConflictMeta {
    hasExistingBlock: boolean;
}
export declare function hashContent(content: string): string;
/**
 * Refines an InstallPlan with content-aware conflict detection.
 * - Skills/agents: same content = no-op, different content = conflict with hashes
 * - Guidance: detects existing managed blocks for this specific package
 * - Deferred entries (hooks/mcp/requirements) pass through unchanged
 */
export declare function detectConflicts(plan: InstallPlan, fs: FsOps): RefinedInstallPlan;
interface ProjectionFsOps {
    readFile(path: string): string;
    exists(path: string): boolean;
}
/**
 * Classify a resource projection using hash-based comparison.
 * Returns projection-specific classification states (not legacy ActionClassification).
 * @param sourcePath - absolute path to source resource
 * @param targetPath - absolute path to target location
 * @param category - resource category
 * @param mergeStrategy - guidance merge strategy if applicable
 * @param fsOps - filesystem operations
 * @returns ProjectionClassification
 */
export declare function classifyResourceProjection(sourcePath: string, targetPath: string, category: string, mergeStrategy: string | undefined, fsOps: ProjectionFsOps, 
/** P20 — the projector's LAST-written hash for targetPath (manifest), or null.
 *  Optional so legacy 5-arg callers keep P17 behavior (no manifest → hash_conflict).
 *  Consulted fail-closed, BROKEN≠ABSENT: a returned null (no entry) → hash_conflict
 *  (P17 fallback); a THROW (broken read) → operator_conflict (PROTECT — a read
 *  error must never overwrite what might be an operator edit). */
lastHashLookup?: (targetPath: string) => string | null): ProjectionClassification;
export {};
//# sourceMappingURL=conflict-detector.d.ts.map