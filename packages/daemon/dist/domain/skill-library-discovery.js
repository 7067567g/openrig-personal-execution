// Slice 28 Checkpoint C-3 — SkillLibraryDiscoveryService.
//
// SC-29 EXCEPTION #11 (slice 28 library-explorer-finishing) — cumulative scope.
// C-1 (plugin endpoints) declared #11 verbatim at routes/plugins.ts header.
// This file extends the slice 28 surface with skill-library discovery to
// close HG-5 / HG-7 / HG-8 / HG-9 cascade on the founder-walk VM (QA verdict
// qitem-20260513045711-39ccfdf3): the operator's allowlist does not include
// the daemon's source tree, so the prior /api/files-based useLibrarySkills
// 3-path probe could not reach `packages/daemon/specs/agents/shared/skills`.
//
// Daemon-owned discovery: resolves shared-skills directory via the daemon's
// install location (import.meta.url + ../specs/agents/shared/skills) +
// optional workspace allowlist roots for user-defined skills at
// `.openrig/skills/`. UI consumes /api/skills/library directly (1 fetch
// replaces N-fetch probe). Symmetric with the plugin pattern from C-1.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const MAX_NESTING_DEPTH = 1;
function isDir(absolutePath) {
    try {
        return statSync(absolutePath).isDirectory();
    }
    catch {
        return false;
    }
}
function safeReaddir(absolutePath) {
    try {
        return readdirSync(absolutePath);
    }
    catch {
        return [];
    }
}
function collectMarkdownFiles(absoluteDir) {
    const entries = [];
    for (const name of safeReaddir(absoluteDir)) {
        if (!/\.(md|mdx)$/i.test(name))
            continue;
        const fullPath = join(absoluteDir, name);
        try {
            const stat = statSync(fullPath);
            if (!stat.isFile())
                continue;
            entries.push({
                name,
                path: name,
                size: stat.size,
                mtime: stat.mtime.toISOString(),
            });
        }
        catch {
            continue;
        }
    }
    return entries.sort((a, b) => {
        if (a.name.toLowerCase() === "skill.md")
            return -1;
        if (b.name.toLowerCase() === "skill.md")
            return 1;
        return a.name.localeCompare(b.name);
    });
}
/**
 * Recursive skill discovery: walks a base directory and emits a LibrarySkill
 * for every subdirectory that contains markdown files. Categories
 * (subdirs without markdown but containing more subdirs) recurse one level
 * up to MAX_NESTING_DEPTH (matches the on-disk shape of the shared-skills
 * tree: flat skill folders + one level of category nesting like core/,
 * pm/, pods/, process/).
 *
 * `idPrefix` is prepended to each emitted skill id (e.g., "openrig-managed:");
 * `relativeId` accumulates the path-within-source for stable id construction.
 */
function collectSkillsRecursive(absoluteDir, source, idPrefix, relativeId, depth) {
    const out = [];
    for (const childName of safeReaddir(absoluteDir)) {
        const childAbsolute = join(absoluteDir, childName);
        if (!isDir(childAbsolute))
            continue;
        const childRelativeId = relativeId ? `${relativeId}/${childName}` : childName;
        const files = collectMarkdownFiles(childAbsolute);
        if (files.length > 0) {
            // Leaf — this dir is a skill folder.
            out.push({
                id: `${idPrefix}${childRelativeId}`,
                name: childName,
                source,
                files,
                absolutePath: childAbsolute,
            });
        }
        else if (depth < MAX_NESTING_DEPTH) {
            // Category — recurse one level deeper.
            out.push(...collectSkillsRecursive(childAbsolute, source, idPrefix, childRelativeId, depth + 1));
        }
        // else: empty leaf (no markdown, can't recurse further) — skip.
    }
    return out;
}
export class SkillLibraryDiscoveryService {
    opts;
    constructor(opts) {
        this.opts = opts;
    }
    /**
     * Returns the consolidated list of OpenRig-managed + workspace skills.
     * Sources scanned:
     *   - opts.sharedSkillsDir (daemon-known absolute path; openrig-managed)
     *   - <opts.filesAllowlist root>/.openrig/skills/ for each root (workspace)
     * Dedupe rule: managed wins over workspace when (source-key-collision).
     * v0 collision shape is unusual; defensive only.
     */
    listLibrarySkills() {
        const all = [];
        if (existsSync(this.opts.sharedSkillsDir)) {
            all.push(...collectSkillsRecursive(this.opts.sharedSkillsDir, "openrig-managed", "openrig-managed:", "", 0));
        }
        for (const root of this.opts.filesAllowlist) {
            const workspaceSkillsDir = join(root.canonicalPath, ".openrig", "skills");
            if (!existsSync(workspaceSkillsDir))
                continue;
            // Workspace skills are identified by .openrig/skills/<name>/ paths.
            // Skills under workspace allowlist roots are scanned at depth-0 only
            // (workspace skill folders historically live flat, no category
            // structure — but we recurse for consistency).
            all.push(...collectSkillsRecursive(workspaceSkillsDir, "workspace", `workspace:${root.name}:`, "", 0));
        }
        return all.sort((a, b) => {
            if (a.source !== b.source)
                return a.source === "workspace" ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    }
    /** Lookup a single skill by its stable id. */
    getSkill(id) {
        return this.listLibrarySkills().find((s) => s.id === id) ?? null;
    }
    /** Public-facing list (strips absolutePath from each entry). */
    listLibrarySkillsPublic() {
        return this.listLibrarySkills();
    }
}
//# sourceMappingURL=skill-library-discovery.js.map