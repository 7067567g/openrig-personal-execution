import type { LifecycleDefaults, RigSpec, RigSpecPod, RigSpecPodMember, StartupBlock, SkillResource, GuidanceResource, SubagentResource, RuntimeResource, PluginResource } from "./types.js";
import type { ResolvedAgentSpec, ResourceCollision } from "./agent-resolver.js";
import { type SkillLoadout } from "./skill-catalog.js";
export interface QualifiedResource {
    effectiveId: string;
    sourceSpec: string;
    sourcePath: string;
    resource: SkillResource | GuidanceResource | SubagentResource | RuntimeResource | PluginResource;
}
export interface ResolvedResources {
    skills: QualifiedResource[];
    guidance: QualifiedResource[];
    subagents: QualifiedResource[];
    plugins: QualifiedResource[];
    runtimeResources: QualifiedResource[];
}
/** Where each selected plugin resolved to, as the projection and the plugin-skill loadout see it. */
export declare function selectedPluginPaths(resources: ResolvedResources): string[];
export interface ResolvedNodeConfig {
    runtime: string;
    model: string | undefined;
    effort: string | undefined;
    cwd: string;
    restorePolicy: string;
    /** OPR.0.5.6.20 — resolved continuity mode (canonical vocabulary; most-specific-wins). */
    compactionStrategy: string;
    /** Resolved continuity mechanic; absent unless explicitly declared. */
    mechanic: string | undefined;
    lifecycle: LifecycleDefaults | undefined;
    selectedResources: ResolvedResources;
    startup: StartupBlock;
    resolvedSpecName: string;
    resolvedSpecVersion: string;
    resolvedSpecHash: string;
    /**
     * Per-seat activity-detection tuning. Forwarded verbatim from
     * `profile.activity` after agent-manifest normalization. Currently
     * inert: the live poller uses the global 3s default and does not
     * read per-seat windows. Retained for a future per-seat decision.
     */
    activity?: {
        silenceWindowSeconds?: number;
    };
    /** Effective managed sources, including explicitly selected bundle overrides.
     *  Runtime projection uses these for exact-byte ownership reconciliation. */
    skillLoadout?: SkillLoadout;
    skillWarnings?: string[];
}
export interface ResolutionContext {
    baseSpec: ResolvedAgentSpec;
    importedSpecs: ResolvedAgentSpec[];
    collisions: ResourceCollision[];
    profileName: string;
    specRoot?: string;
    cwdOverride?: string;
    member: RigSpecPodMember;
    pod: RigSpecPod;
    rig: RigSpec;
    operatorStartup?: StartupBlock;
    /** V0.3.0 daemon-skill-discovery (SC-29 #7): operator home directory
     *  used to scan filesystem-discovered skills (~/.openrig/skills/,
     *  ~/.claude/skills/, ~/.agents/skills/). Defaults to os.homedir()
     *  in production; tests inject a fixture root. */
    homedir?: string;
    /** Config-resolved managed skill catalog root. */
    skillsRoot?: string;
    /** System World-owned managed skill identities. When absent, the legacy
     *  catalog.yaml selector remains the compatibility fallback. */
    systemSkills?: string[];
    /** A selected System World that could not be resolved. This is a launch
     *  refusal, never a silent fallback to the legacy catalog selector. */
    systemWorldError?: string;
}
export type ResolutionResult = {
    ok: true;
    config: ResolvedNodeConfig;
} | {
    ok: false;
    errors: string[];
};
/**
 * Resolve effective node configuration from agent spec, profile, and rig context.
 * @param ctx - resolution context with all inputs
 * @returns resolved config or errors
 */
export declare function resolveNodeConfig(ctx: ResolutionContext): ResolutionResult;
//# sourceMappingURL=profile-resolver.d.ts.map