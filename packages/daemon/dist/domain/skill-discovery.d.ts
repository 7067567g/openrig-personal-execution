import type { SkillResource } from "./types.js";
export type SkillRuntime = "claude-code" | "codex" | "pi";
export interface SkillDiscoveryPaths {
    runtime: SkillRuntime;
    /** Operator home dir (resolved by the daemon at startup, NOT read
     *  here via os.homedir() so tests can inject a fixture root). */
    homedir: string;
    /** The agent's resolved working directory — rig-bundled skills live
     *  under <cwd>/.claude/skills/ or <cwd>/.agents/skills/. */
    cwd: string;
    /** The rig-spec install dir — bundled domain skills live under
     *  <specInstallDir>/skills/<name>/. Optional: undefined means the
     *  rig was installed in-place and no separate install-dir applies. */
    specInstallDir?: string;
    /** Config-resolved managed catalog root. Defaults to the legacy
     *  <homedir>/.openrig/skills path when omitted for compatibility. */
    skillsRoot?: string;
}
export interface SkillFrontmatter {
    name: string;
    description: string;
    /** Any other fields the runtime may consume (allowed-tools, model,
     *  etc.) pass through unchecked — they are not load-bearing for
     *  daemon resource validation. */
    [key: string]: unknown;
}
export type ParseResult = {
    ok: true;
    frontmatter: SkillFrontmatter;
    body: string;
} | {
    ok: false;
    reason: string;
};
export interface SkillRejection {
    path: string;
    reason: string;
}
export interface SkillDiscoveryResult {
    skills: SkillResource[];
    rejected: SkillRejection[];
}
export type SourceKind = "rig_bundled" | "spec_install" | "runtime_user" | "shared_user";
export interface SkillProvenanceEntry {
    id: string;
    path: string;
    sourceRoot: string;
    sourceKind: SourceKind;
    frontmatter: SkillFrontmatter;
    body: string;
    shadowed: boolean;
}
export interface SkillProvenanceResult {
    skills: SkillProvenanceEntry[];
    rejected: SkillRejection[];
}
/** Parse a SKILL.md document into frontmatter + body, validating the
 *  shape Claude Code and Codex both require: a YAML frontmatter block
 *  delimited by `---` lines, with at minimum `name` + `description`
 *  fields, plus a non-empty body. */
export declare function parseSkillFrontmatter(content: string): ParseResult;
/** Discover skills for a runtime by scanning the canonical filesystem
 *  paths and structurally validating each candidate. Returns the
 *  accepted skills as SkillResource records (id from frontmatter; path
 *  pointing at the skill directory) plus a list of rejections so the
 *  caller can surface clear errors when validation fails. */
export declare function discoverSkillsForRuntime(paths: SkillDiscoveryPaths): SkillDiscoveryResult;
export declare function discoverSkillsWithProvenance(paths: SkillDiscoveryPaths): SkillProvenanceResult;
//# sourceMappingURL=skill-discovery.d.ts.map