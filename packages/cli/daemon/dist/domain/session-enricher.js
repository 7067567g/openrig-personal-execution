const EMPTY_RESULT = {
    skills: [],
    claudeSkills: [],
    agentsSkills: [],
    hasClaudeMd: false,
    hasAgentsMd: false,
    hasPackageYaml: false,
    raw: {},
};
/**
 * Config sniffing from a session's cwd. Checks for agent config
 * directories, guidance files, skills, and package manifests.
 * Pure filesystem reads — no exec, no adapters.
 */
export class SessionEnricher {
    fsExists;
    fsReaddir;
    constructor(deps) {
        this.fsExists = deps.fsExists;
        this.fsReaddir = deps.fsReaddir;
    }
    /** Enrich a session by sniffing config from its cwd. */
    enrich(cwd) {
        if (!cwd || !this.fsExists(cwd)) {
            return { ...EMPTY_RESULT, raw: {} };
        }
        const hasClaudeMd = this.fsExists(`${cwd}/CLAUDE.md`);
        const hasAgentsMd = this.fsExists(`${cwd}/AGENTS.md`);
        const hasPackageYaml = this.fsExists(`${cwd}/package.yaml`);
        const claudeSkills = this.safeReaddir(`${cwd}/.claude/skills`);
        const agentsSkills = this.safeReaddir(`${cwd}/.agents/skills`);
        const skills = [...claudeSkills, ...agentsSkills];
        const raw = {
            hasClaudeMd,
            hasAgentsMd,
            hasPackageYaml,
            claudeSkills,
            agentsSkills,
            skills,
        };
        return { skills, claudeSkills, agentsSkills, hasClaudeMd, hasAgentsMd, hasPackageYaml, raw };
    }
    safeReaddir(path) {
        if (!this.fsExists(path))
            return [];
        try {
            return this.fsReaddir(path);
        }
        catch {
            return [];
        }
    }
}
//# sourceMappingURL=session-enricher.js.map