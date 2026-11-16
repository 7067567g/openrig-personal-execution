/** Result of enriching a discovered session with config context */
export interface EnrichmentResult {
    skills: string[];
    claudeSkills: string[];
    agentsSkills: string[];
    hasClaudeMd: boolean;
    hasAgentsMd: boolean;
    hasPackageYaml: boolean;
    raw: Record<string, unknown>;
}
interface EnricherDeps {
    fsExists: (path: string) => boolean;
    fsReaddir: (path: string) => string[];
}
/**
 * Config sniffing from a session's cwd. Checks for agent config
 * directories, guidance files, skills, and package manifests.
 * Pure filesystem reads — no exec, no adapters.
 */
export declare class SessionEnricher {
    private fsExists;
    private fsReaddir;
    constructor(deps: EnricherDeps);
    /** Enrich a session by sniffing config from its cwd. */
    enrich(cwd: string | null): EnrichmentResult;
    private safeReaddir;
}
export {};
//# sourceMappingURL=session-enricher.d.ts.map