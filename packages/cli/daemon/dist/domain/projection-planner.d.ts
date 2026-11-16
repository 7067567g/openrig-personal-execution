import type { StartupBlock } from "./types.js";
import type { ResolvedNodeConfig } from "./profile-resolver.js";
import type { ResourceCollision } from "./agent-resolver.js";
import type { ResolvedStartupFile } from "./runtime-adapter.js";
import { type ClaudeManagedBlockFile } from "./managed-blocks.js";
export type ProjectionClassification = "safe_projection" | "managed_merge" | "hash_conflict" | "no_op" | "stale_overwrite" | "operator_conflict";
export interface ProjectionEntry {
    category: "skill" | "guidance" | "subagent" | "plugin" | "runtime_resource";
    effectiveId: string;
    sourceSpec: string;
    sourcePath: string;
    resourcePath: string;
    absolutePath: string;
    resourceType?: string;
    classification: ProjectionClassification;
    conflictDetail?: {
        reason: string;
        existingHash?: string;
        sourceHash?: string;
    };
    mergeStrategy?: "managed_block" | "append";
    target?: string;
    /** Plugin runtime applicability hint. Only meaningful for category=plugin.
     *  - "claude" / "codex": explicit operator override; only the named runtime adapter projects
     *  - "auto" or undefined: adapter detects manifest dirs (.claude-plugin/ vs .codex-plugin/)
     *    and projects only when its runtime-specific manifest is present
     */
    pluginType?: "claude" | "codex" | "auto";
}
export interface ProjectionPlan {
    runtime: string;
    cwd: string;
    entries: ProjectionEntry[];
    startup: StartupBlock;
    conflicts: ProjectionEntry[];
    noOps: ProjectionEntry[];
    diagnostics: string[];
}
export interface ProjectionFsOps {
    readFile(path: string): string;
    exists(path: string): boolean;
}
export interface ProjectionInput {
    config: ResolvedNodeConfig;
    collisions: ResourceCollision[];
    fsOps: ProjectionFsOps;
    /** Optional: resolve target path for conflict detection. If absent, all entries are safe_projection.
     *  P17: the source absolutePath rides as the 4th arg so file-shaped targets
     *  (subagent basenames) can be derived; existing 3-arg callers unaffected. */
    resolveTargetPath?: (category: string, effectiveId: string, cwd: string, sourcePath?: string) => string | null;
    /** P20 — the projector's LAST-written hash for a target (from the projection
     *  manifest), or null. Absent → classify falls back to P17 (hash_conflict).
     *  Consulted fail-closed inside classify (a throw → no-manifest fallback). */
    lastHashLookup?: (targetPath: string) => string | null;
}
export type PlanResult = {
    ok: true;
    plan: ProjectionPlan;
} | {
    ok: false;
    errors: string[];
};
/**
 * Plan the effective runtime projection for one resolved node.
 * @param input - resolved config, collision diagnostics, and filesystem ops
 * @returns projection plan or errors
 */
export declare function planProjection(input: ProjectionInput): PlanResult;
/**
 * Resolve a plugin source.path to a concrete absolute path.
 * Four forms supported:
 *   - absolute (`/abs/...`)        → preserved exactly
 *   - tilde-home (`~/...` or `~`)  → expanded to os.homedir()
 *   - OpenRig home (`openrig-home:plugins/...`) → configured daemon home
 *   - relative (`plugins/...`)     → resolved against specSourcePath
 * `~user/...` (with explicit username) is NOT expanded; treated as a
 * literal relative segment per Node's nodePath convention.
 */
export declare function resolvePluginPath(rawPath: string, specSourcePath: string, openrigHome?: string): string;
/** Map a projection entry to the concrete FILE the claude adapter would write,
 *  for hash-conflict detection. Mirrors claude-code-adapter.resolveTargetDir:
 *  categories whose write is a merge or a whole directory return null —
 *  their classification stays deferred to the adapter, exactly as before. */
export declare function claudeConflictTargetPath(category: string, effectiveId: string, cwd: string, sourcePath?: string, managedBlockFile?: ClaudeManagedBlockFile): string | null;
/** Render plan conflicts as LOUD instantiate warnings: the file, the reason,
 *  and the consequence stated plainly. Restores the warnings-site threading the
 *  4.8 restack dropped — a divergent target is never silently overwritten again
 *  (it is overwritten WITH a named warning; manifest-based operator-vs-stale
 *  discrimination is the routed follow-on). */
export declare function projectionConflictWarnings(plan: Pick<ProjectionPlan, "conflicts">): string[];
/** P20 atom-4 — PROTECT. An operator_conflict means the target diverged from BOTH
 *  our last recorded write and the current source: an operator edited a projected
 *  file. Hold those files back from delivery so the adapter never overwrites the
 *  edit — unless the operator explicitly forces re-projection. hash_conflict (no
 *  manifest yet) is NOT protected: it stays the P17 overwrite-with-warning fallback,
 *  since operator-vs-stale can't be told apart without a recorded last hash.
 *  Returns the files to deliver and the files held back (for reporting). */
export declare function filterProtectedProjections(files: ResolvedStartupFile[], plan: Pick<ProjectionPlan, "conflicts">, opts?: {
    force?: boolean;
}): {
    delivered: ResolvedStartupFile[];
    protected: ResolvedStartupFile[];
};
//# sourceMappingURL=projection-planner.d.ts.map