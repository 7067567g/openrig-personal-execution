import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative, dirname, extname } from "node:path";
import { createHash } from "node:crypto";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
function makeId(sourceType, relativePath) {
    return createHash("sha256")
        .update(`${sourceType}:${relativePath}`)
        .digest("hex")
        .slice(0, 16);
}
function isYamlFile(filename) {
    return filename.endsWith(".yaml") || filename.endsWith(".yml");
}
// OPR.0.3.2.22 Bug 4 — noise directories that should never enter the
// spec library walk. The set matches progress-indexer.ts:81 exactly.
// frontmatter-validator.ts:103 is a related scanner that uses a
// narrower subset (node_modules / .git / .worktrees / dist / build);
// if this list and the progress-indexer list ever diverge, reconcile
// there first. The `.worktrees` entry closes the stale-row class
// where conveyor.yaml inside a worktree was sliding into the library
// cache and producing the `rig specs show conveyor` ambiguous-match UX.
const SKIP_DIRS = new Set([
    ".worktrees",
    "node_modules",
    ".git",
    "dist",
    "build",
    ".turbo",
    ".next",
]);
function walkYamlFiles(rootPath) {
    const files = [];
    const stack = [rootPath];
    while (stack.length > 0) {
        const current = stack.pop();
        let entries;
        try {
            entries = readdirSync(current, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            const absPath = join(current, entry.name);
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name))
                    continue;
                stack.push(absPath);
                continue;
            }
            if (entry.isFile() && isYamlFile(entry.name)) {
                files.push(absPath);
            }
        }
    }
    files.sort();
    return files;
}
function shouldIndexRelativePath(sourceType, relPath) {
    if (sourceType !== "builtin") {
        return true;
    }
    const normalized = relPath.replaceAll("\\", "/");
    return normalized.startsWith("rigs/") ? normalized.endsWith("/rig.yaml") : normalized.endsWith("/agent.yaml");
}
export class SpecLibraryService {
    entries = new Map();
    /** Workflow entries are written by the route layer via
     *  setWorkflowEntries() — kept separate from the rig+agent scan
     *  because their source-of-truth is the workflow_specs SQLite cache,
     *  not YAML files on disk. */
    workflowEntries = new Map();
    roots;
    specReviewService;
    constructor(opts) {
        this.roots = opts.roots;
        this.specReviewService = opts.specReviewService;
    }
    scan() {
        const newEntries = new Map();
        for (const root of this.roots) {
            const files = walkYamlFiles(root.path);
            if (files.length === 0) {
                continue;
            }
            for (const absPath of files) {
                const relPath = relative(root.path, absPath);
                if (!shouldIndexRelativePath(root.sourceType, relPath)) {
                    continue;
                }
                let yaml;
                try {
                    yaml = readFileSync(absPath, "utf-8");
                }
                catch {
                    continue; // Can't read — skip
                }
                let stat;
                try {
                    stat = statSync(absPath);
                }
                catch {
                    continue;
                }
                const entry = this.classifySpec(yaml, root.sourceType, absPath, relPath, stat.mtimeMs);
                if (entry) {
                    newEntries.set(entry.id, entry);
                }
            }
        }
        this.entries = newEntries;
    }
    list(filter) {
        const entries = [
            ...Array.from(this.entries.values()),
            ...Array.from(this.workflowEntries.values()),
        ];
        if (filter?.kind) {
            return entries.filter((e) => e.kind === filter.kind);
        }
        return entries;
    }
    /** Workflows in Spec Library v0: replace the workflow-entry projection
     *  in one shot. Called by the route layer after running
     *  scanWorkflowSpecs() against the workflow_specs SQLite cache. */
    setWorkflowEntries(entries) {
        const next = new Map();
        for (const entry of entries) {
            if (entry.kind !== "workflow")
                continue;
            next.set(entry.id, entry);
        }
        this.workflowEntries = next;
    }
    get(id) {
        // Workflow entries: yaml is read from the source path on demand.
        const wfEntry = this.workflowEntries.get(id);
        if (wfEntry) {
            let yaml = "";
            try {
                yaml = readFileSync(wfEntry.sourcePath, "utf-8");
            }
            catch { /* tolerate */ }
            return { entry: wfEntry, yaml };
        }
        const entry = this.entries.get(id);
        if (!entry)
            return null;
        try {
            const yaml = readFileSync(entry.sourcePath, "utf-8");
            return { entry, yaml };
        }
        catch {
            return null;
        }
    }
    remove(id) {
        const entry = this.entries.get(id);
        if (!entry) {
            return { ok: false, code: "not_found", error: `Spec '${id}' not found in library` };
        }
        if (entry.sourceType !== "user_file") {
            return { ok: false, code: "read_only", error: `Spec '${entry.name}' is built in and cannot be removed.` };
        }
        unlinkSync(entry.sourcePath);
        this.scan();
        return { ok: true, entry };
    }
    rename(id, newName) {
        const entry = this.entries.get(id);
        if (!entry) {
            return { ok: false, code: "not_found", error: `Spec '${id}' not found in library` };
        }
        if (entry.sourceType !== "user_file") {
            return { ok: false, code: "read_only", error: `Spec '${entry.name}' is built in and cannot be renamed.` };
        }
        const trimmedName = newName.trim();
        if (!trimmedName) {
            return { ok: false, code: "invalid_spec", error: "name is required" };
        }
        if (Array.from(this.entries.values()).some((candidate) => candidate.id !== id && candidate.name === trimmedName)) {
            return { ok: false, code: "conflict", error: `Spec name '${trimmedName}' already exists in the library.` };
        }
        const yaml = readFileSync(entry.sourcePath, "utf-8");
        const raw = parseYaml(yaml);
        if (!raw || typeof raw !== "object") {
            return { ok: false, code: "invalid_spec", error: `Spec '${entry.name}' could not be parsed for rename.` };
        }
        raw["name"] = trimmedName;
        const extension = extname(entry.sourcePath) || ".yaml";
        const fileSafeName = trimmedName.replace(/[^A-Za-z0-9._-]+/g, "-");
        const nextPath = join(dirname(entry.sourcePath), `${fileSafeName}${extension}`);
        if (nextPath !== entry.sourcePath) {
            try {
                statSync(nextPath);
                return { ok: false, code: "conflict", error: `A spec file already exists at ${nextPath}.` };
            }
            catch {
                // target path is free
            }
        }
        const nextYaml = stringifyYaml(raw);
        if (nextPath === entry.sourcePath) {
            writeFileSync(entry.sourcePath, nextYaml, "utf-8");
        }
        else {
            writeFileSync(nextPath, nextYaml, "utf-8");
            unlinkSync(entry.sourcePath);
        }
        this.scan();
        const renamed = Array.from(this.entries.values()).find((candidate) => candidate.sourcePath === nextPath);
        return renamed
            ? { ok: true, entry: renamed }
            : { ok: false, code: "invalid_spec", error: `Renamed spec '${trimmedName}' could not be reloaded.` };
    }
    classifySpec(yaml, sourceType, absPath, relPath, mtimeMs) {
        // Try rig first
        try {
            const review = this.specReviewService.reviewRigSpec(yaml, "library_item");
            let hasServices = false;
            try {
                const raw = parseYaml(yaml);
                hasServices = !!(raw["services"] && typeof raw["services"] === "object");
            }
            catch { /* safe default */ }
            return {
                id: makeId(sourceType, relPath),
                kind: "rig",
                name: review.name,
                version: review.version,
                sourceType,
                sourcePath: absPath,
                relativePath: relPath,
                updatedAt: new Date(mtimeMs).toISOString(),
                summary: review.summary,
                ...(hasServices ? { hasServices } : {}),
            };
        }
        catch {
            // Not a valid rig spec
        }
        // Try agent
        try {
            const review = this.specReviewService.reviewAgentSpec(yaml, "library_item");
            return {
                id: makeId(sourceType, relPath),
                kind: "agent",
                name: review.name,
                version: review.version,
                sourceType,
                sourcePath: absPath,
                relativePath: relPath,
                updatedAt: new Date(mtimeMs).toISOString(),
                summary: review.description,
            };
        }
        catch {
            // Not a valid agent spec either — skip
        }
        return null;
    }
}
//# sourceMappingURL=spec-library-service.js.map