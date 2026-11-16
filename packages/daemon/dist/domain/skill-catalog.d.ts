export type SkillSelectionSource = "system" | "topology" | "project";
export type SkillRuntime = "claude-code" | "codex";
export interface CatalogSkill {
    id: string;
    sourceDir: string;
    sourceRoot: string;
    revision: string;
    digest: string;
    files: Record<string, string>;
    selectedBy: SkillSelectionSource[];
    /** Set when the skill comes from a selected plugin. Such a skill never displaces
     *  a same-name skill OpenRig does not own (see reconcileSkillLoadout). */
    pluginId?: string;
}
/** A catalog skill left out of the loadout because its folder has uncommitted or untracked content. */
export interface SkippedCatalogSkill {
    id: string;
    sourceDir: string;
    /** Empty when nothing selected it. */
    selectedBy: SkillSelectionSource[];
    /** `catalog_skill_skipped: …`, or `selected_skill_skipped: …` when something selected it. */
    message: string;
}
export interface SkillLoadout {
    catalogRoot: string;
    catalogRevision: string | null;
    catalogDigest: string | null;
    /** Distinguishes an explicitly installed empty project loadout from a
     *  startup that has no project-world input and must retain the installed one. */
    projectSelectionDeclared: boolean;
    projectSelection: string[];
    entries: CatalogSkill[];
    /** Dirty skills left out of `entries`; each blocks only itself. */
    skipped?: SkippedCatalogSkill[];
}
export interface SkillCatalogFailure {
    code: string;
    message: string;
    path?: string;
}
export type ResolveSkillLoadoutResult = {
    ok: true;
    loadout: SkillLoadout;
} | {
    ok: false;
    errors: SkillCatalogFailure[];
};
export type SkillProjectionStatus = "current" | "missing" | "shadowed" | "stale" | "conflicting";
export interface SkillProjectionReceipt {
    id: string;
    selectedBy: SkillSelectionSource[];
    sourceRoot: string;
    revision: string;
    digest: string;
    target: string;
    status: SkillProjectionStatus;
    detail: string;
}
export interface ReconcileSkillLoadoutResult {
    ok: boolean;
    applied: boolean;
    freshLaunchRequired: boolean;
    runtime: SkillRuntime;
    targetRoot: string;
    manifestPath: string;
    receipts: SkillProjectionReceipt[];
    removed: string[];
    errors: SkillCatalogFailure[];
}
export declare function readSystemSkillSelection(catalogRoot: string): string[];
export declare function readProjectSkillSelection(projectRoot: string): string[];
export declare function inspectSkillDirectory(root: string): {
    digest: string;
    files: Record<string, string>;
};
export declare function resolveSkillLoadout(input: {
    catalogRoot: string;
    systemSkills?: string[];
    topologySkills?: string[];
    projectRoot?: string;
    projectSkills?: string[];
    allowMissingTopology?: boolean;
}): ResolveSkillLoadoutResult;
/** A selected plugin's skills as loadout entries for one runtime. Neither Claude Code
 *  nor Codex reads skills from the plugin folder OpenRig projects into a seat's working
 *  directory, so they travel in the managed loadout instead. A plugin applies to a
 *  runtime as the adapters decide: an explicit pluginType, otherwise the runtime's own
 *  manifest (.claude-plugin/ or .codex-plugin/). */
export declare function resolvePluginSkills(input: {
    pluginId: string;
    pluginRoot: string;
    runtime: SkillRuntime;
    pluginType?: "claude" | "codex" | "auto";
}): {
    entries: CatalogSkill[];
    warnings: string[];
};
/** A plugin skill left out because a skill OpenRig does not own already has its name. */
export declare function isKeptPluginSkill(receipt: SkillProjectionReceipt): boolean;
export declare function reconcileSkillLoadout(input: {
    loadout: SkillLoadout;
    runtime: SkillRuntime;
    cwd: string;
    apply?: boolean;
    /** Stable seat/session identity whose topology selector is being reconciled.
     *  Different seats may share one cwd; their role selections compose as a
     *  union instead of deleting one another. CLI-only reconciliation uses the
     *  workspace owner. */
    topologyOwner?: string;
}): ReconcileSkillLoadoutResult;
//# sourceMappingURL=skill-catalog.d.ts.map