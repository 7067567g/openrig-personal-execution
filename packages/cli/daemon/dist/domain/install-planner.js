import path from "node:path";
import { resolveExports } from "./role-resolver.js";
/**
 * Refuse a planned destination that would land outside the install target.
 *
 * Export names are joined with `path.join`, so a name can only leave the target
 * by climbing above it with enough `..` segments; a leading `/`, a drive-letter
 * like `a:b`, a backslash and a shallow `..` are ordinary segments that stay
 * inside on POSIX. Check the joined path the same way the planner built it,
 * relative to the target, so the refusal matches what would actually be written.
 */
function assertInsideTarget(targetRoot, targetPath, label) {
    const relative = path.relative(targetRoot, targetPath);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error(`${label} would write outside the install target: '${targetPath}'`);
    }
}
// --- Planner ---
export class InstallPlanner {
    fs;
    constructor(fs) {
        this.fs = fs;
    }
    plan(resolved, targetRoot, runtime, options) {
        // R2-H2: Compatibility check — runtime must be in manifest's runtimes
        if (!resolved.manifest.compatibility.runtimes.includes(runtime)) {
            throw new Error(`Package '${resolved.manifest.name}' does not support runtime '${runtime}'. Supported: ${resolved.manifest.compatibility.runtimes.join(", ")}`);
        }
        const exports = resolveExports(resolved.manifest, options?.roleName);
        const entries = [];
        // Plan skills
        for (const skill of exports.skills) {
            // R2-H2: Scope enforcement — skip/defer entries that don't support project_shared
            if (skill.supportedScopes && !skill.supportedScopes.includes("project_shared")) {
                entries.push({
                    exportType: "skill",
                    exportName: skill.name,
                    classification: "config_mutation",
                    targetPath: "",
                    scope: "project_shared",
                    deferred: true,
                    deferReason: `Skill '${skill.name}' does not support project_shared scope`,
                });
                continue;
            }
            // R2-H1: Enumerate all files in the skill source directory
            const sourceDir = path.join(resolved.sourceRef, skill.source);
            const files = this.fs.listFiles ? this.fs.listFiles(sourceDir) : ["SKILL.md"];
            for (const file of files) {
                const targetPath = runtime === "claude-code"
                    ? path.join(targetRoot, ".claude", "skills", skill.name, file)
                    : path.join(targetRoot, ".agents", "skills", skill.name, file);
                assertInsideTarget(targetRoot, targetPath, `Skill '${skill.name}/${file}'`);
                const exists = this.fs.exists(targetPath);
                const entry = {
                    exportType: "skill",
                    exportName: `${skill.name}/${file}`,
                    classification: "safe_projection",
                    targetPath,
                    sourcePath: path.join(sourceDir, file),
                    scope: "project_shared",
                    deferred: false,
                };
                // F2.1: Source file existence check
                if (!this.fs.exists(entry.sourcePath)) {
                    throw new Error(`Source file not found: ${entry.sourcePath}`);
                }
                if (exists) {
                    entry.conflict = {
                        existingPath: targetPath,
                        reason: `Skill '${skill.name}/${file}' already exists at target`,
                    };
                }
                entries.push(entry);
            }
        }
        // Plan guidance
        for (const g of exports.guidance) {
            // R2-H2: Scope enforcement
            if (g.supportedScopes && !g.supportedScopes.includes("project_shared")) {
                entries.push({
                    exportType: "guidance",
                    exportName: g.name,
                    classification: "config_mutation",
                    targetPath: "",
                    scope: "project_shared",
                    deferred: true,
                    deferReason: `Guidance '${g.name}' does not support project_shared scope`,
                });
                continue;
            }
            // Runtime/guidance kind mismatch → defer
            if (g.kind === "agents_md" && runtime === "claude-code") {
                entries.push({
                    exportType: "guidance",
                    exportName: g.name,
                    classification: "config_mutation",
                    targetPath: "",
                    scope: "project_shared",
                    deferred: true,
                    deferReason: "agents_md guidance not applicable to claude-code",
                });
                continue;
            }
            if (g.kind === "claude_md" && runtime === "codex") {
                entries.push({
                    exportType: "guidance",
                    exportName: g.name,
                    classification: "config_mutation",
                    targetPath: "",
                    scope: "project_shared",
                    deferred: true,
                    deferReason: "claude_md guidance not applicable to codex",
                });
                continue;
            }
            // generic_rules_overlay → defer
            if (g.kind === "generic_rules_overlay") {
                entries.push({
                    exportType: "guidance",
                    exportName: g.name,
                    classification: "config_mutation",
                    targetPath: "",
                    scope: "project_shared",
                    deferred: true,
                    deferReason: "generic_rules_overlay not supported in Phase 4",
                });
                continue;
            }
            // replace/manual strategy → defer
            if (g.mergeStrategy === "replace" || g.mergeStrategy === "manual") {
                entries.push({
                    exportType: "guidance",
                    exportName: g.name,
                    classification: "manual_only",
                    targetPath: "",
                    scope: "project_shared",
                    deferred: true,
                    deferReason: `${g.mergeStrategy} merge not supported in Phase 4`,
                });
                continue;
            }
            // Determine target path
            const targetFile = g.kind === "agents_md" ? "AGENTS.md" : "CLAUDE.md";
            const targetPath = path.join(targetRoot, targetFile);
            const exists = this.fs.exists(targetPath);
            const guidanceSourcePath = path.join(resolved.sourceRef, g.source);
            // F2.1: Source file existence check
            if (!this.fs.exists(guidanceSourcePath)) {
                throw new Error(`Source file not found: ${guidanceSourcePath}`);
            }
            entries.push({
                exportType: "guidance",
                exportName: g.name,
                classification: exists ? "managed_merge" : "safe_projection",
                targetPath,
                sourcePath: guidanceSourcePath,
                scope: "project_shared",
                deferred: false,
            });
        }
        // Plan agents (single YAML files, not directories)
        for (const agent of exports.agents) {
            const agentName = agent.name ?? path.basename(agent.source, path.extname(agent.source));
            // R2-H2: Scope enforcement
            if (agent.supportedScopes && !agent.supportedScopes.includes("project_shared")) {
                entries.push({
                    exportType: "agent",
                    exportName: agentName,
                    classification: "config_mutation",
                    targetPath: "",
                    scope: "project_shared",
                    deferred: true,
                    deferReason: `Agent '${agentName}' does not support project_shared scope`,
                });
                continue;
            }
            const targetPath = runtime === "claude-code"
                ? path.join(targetRoot, ".claude", "agents", `${agentName}.yaml`)
                : path.join(targetRoot, ".agents", `${agentName}.yaml`);
            assertInsideTarget(targetRoot, targetPath, `Agent '${agentName}'`);
            const agentSourcePath = path.join(resolved.sourceRef, agent.source);
            // F2.1: Source file existence check
            if (!this.fs.exists(agentSourcePath)) {
                throw new Error(`Source file not found: ${agentSourcePath}`);
            }
            const exists = this.fs.exists(targetPath);
            const entry = {
                exportType: "agent",
                exportName: agentName,
                classification: "safe_projection",
                targetPath,
                sourcePath: agentSourcePath,
                scope: "project_shared",
                deferred: false,
            };
            if (exists) {
                entry.conflict = {
                    existingPath: targetPath,
                    reason: `Agent '${agentName}' already exists at target`,
                };
            }
            entries.push(entry);
        }
        // Plan deferred (hooks, mcp from role resolver)
        for (const d of exports.deferred) {
            entries.push({
                exportType: d.exportType,
                exportName: d.source,
                classification: "config_mutation",
                targetPath: "",
                scope: "project_shared",
                deferred: true,
                deferReason: d.reason,
            });
        }
        // Plan requirements as deferred
        if (resolved.manifest.requirements?.cliTools) {
            for (const tool of resolved.manifest.requirements.cliTools) {
                entries.push({
                    exportType: "requirement",
                    exportName: tool.name,
                    classification: "external_install",
                    targetPath: "",
                    scope: "project_shared",
                    deferred: true,
                    deferReason: `CLI tool '${tool.name}' requires external install (Phase 5)`,
                });
            }
        }
        if (resolved.manifest.requirements?.systemPackages) {
            for (const pkg of resolved.manifest.requirements.systemPackages) {
                entries.push({
                    exportType: "requirement",
                    exportName: pkg.name,
                    classification: "external_install",
                    targetPath: "",
                    scope: "project_shared",
                    deferred: true,
                    deferReason: `System package '${pkg.name}' requires external install (Phase 5)`,
                });
            }
        }
        // Split into categories
        const actionable = entries.filter((e) => !e.deferred && !e.conflict);
        const deferred = entries.filter((e) => e.deferred);
        const conflicts = entries.filter((e) => !!e.conflict && !e.deferred);
        return {
            // packageId is undefined until caller persists to DB
            packageName: resolved.manifest.name,
            packageVersion: resolved.manifest.version,
            sourceRef: resolved.sourceRef,
            entries,
            actionable,
            deferred,
            conflicts,
        };
    }
}
//# sourceMappingURL=install-planner.js.map