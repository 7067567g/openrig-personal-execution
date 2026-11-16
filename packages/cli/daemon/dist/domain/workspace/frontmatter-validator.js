// PL-007 Workspace Primitive v0 — frontmatter validator (advisory).
//
// Walks a workspace root, parses each .md file's YAML frontmatter
// (delimited by `---` lines at the start of file), and validates per-kind
// required fields. Outputs a structured gap report:
//
//   - missing-required-field
//   - unrecognized-status-value
//   - parse-error  (frontmatter present but malformed)
//   - missing-frontmatter (no frontmatter delimiter found)
//
// Advisory only — never modifies files. curate-steward consumes the
// gap report as hygiene input. The validator is deliberately minimal at
// v0 (per PL-007 PRD); broken-cross-reference / non-conforming-structure
// rules are deferred to v1+.
import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";
import { WORKSPACE_KINDS } from "../types.js";
const VALID_STATUS_VALUES = new Set(["active", "draft", "archived", "superseded"]);
/** Per-kind required frontmatter fields. v0 minimum baseline (advisory). */
const REQUIRED_FIELDS_BY_KIND = {
    user: ["doc"],
    project: ["doc"],
    knowledge: ["doc", "status", "created", "owner"],
    lab: ["doc", "status", "created", "owner"],
    delivery: ["doc", "status", "created", "owner"],
};
/** Run the frontmatter validator. */
export function validateWorkspaceFrontmatter(opts) {
    const root = path.resolve(opts.root);
    const recursive = opts.recursive ?? true;
    const requireFrontmatter = opts.requireFrontmatter ?? false;
    const maxFiles = opts.maxFiles ?? 10000;
    const kind = isValidKind(opts.workspaceKind) ? opts.workspaceKind : null;
    const gaps = [];
    let totalFiles = 0;
    let filesWithFrontmatter = 0;
    const walk = (dir) => {
        if (totalFiles >= maxFiles)
            return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (totalFiles >= maxFiles)
                return;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!recursive)
                    continue;
                // Skip noise dirs that aren't canon: node_modules, .git, .worktrees,
                // dist/build artifacts. Authors writing canon don't put these here.
                if (entry.name === "node_modules" ||
                    entry.name === ".git" ||
                    entry.name === ".worktrees" ||
                    entry.name === "dist" ||
                    entry.name === "build")
                    continue;
                walk(full);
                continue;
            }
            if (!entry.isFile() || !entry.name.endsWith(".md"))
                continue;
            totalFiles++;
            const result = validateFile(full, root, kind, requireFrontmatter);
            if (result.hasFrontmatter)
                filesWithFrontmatter++;
            gaps.push(...result.gaps);
        }
    };
    walk(root);
    return {
        root,
        workspaceKind: kind,
        totalFiles,
        filesWithFrontmatter,
        gapCount: gaps.length,
        gaps,
    };
}
function isValidKind(k) {
    return typeof k === "string" && WORKSPACE_KINDS.includes(k);
}
function validateFile(filePath, root, kind, requireFrontmatter) {
    const relativePath = path.relative(root, filePath);
    const out = { hasFrontmatter: false, gaps: [] };
    let raw;
    try {
        raw = fs.readFileSync(filePath, "utf-8");
    }
    catch {
        return out;
    }
    const fm = extractFrontmatter(raw);
    if (!fm.found) {
        if (requireFrontmatter) {
            out.gaps.push({
                filePath,
                relativePath,
                kind: "missing-frontmatter",
                field: null,
                message: "no frontmatter delimiter (---) found at start of file",
                workspaceKind: kind,
            });
        }
        return out;
    }
    out.hasFrontmatter = true;
    let parsed;
    try {
        parsed = parseYaml(fm.body);
    }
    catch (err) {
        out.gaps.push({
            filePath,
            relativePath,
            kind: "parse-error",
            field: null,
            message: err instanceof Error ? err.message : "YAML parse error",
            workspaceKind: kind,
        });
        return out;
    }
    if (!parsed || typeof parsed !== "object") {
        out.gaps.push({
            filePath,
            relativePath,
            kind: "parse-error",
            field: null,
            message: "frontmatter is not a YAML object",
            workspaceKind: kind,
        });
        return out;
    }
    if (kind) {
        const required = REQUIRED_FIELDS_BY_KIND[kind];
        for (const field of required) {
            if (!(field in parsed) || parsed[field] === null || parsed[field] === undefined || parsed[field] === "") {
                out.gaps.push({
                    filePath,
                    relativePath,
                    kind: "missing-required-field",
                    field,
                    message: `${kind} canon requires "${field}" frontmatter field`,
                    workspaceKind: kind,
                });
            }
        }
        // status enum check (only when status is present + a string)
        if (typeof parsed["status"] === "string" && !VALID_STATUS_VALUES.has(parsed["status"])) {
            out.gaps.push({
                filePath,
                relativePath,
                kind: "unrecognized-status-value",
                field: "status",
                message: `status "${parsed["status"]}" is not one of: ${[...VALID_STATUS_VALUES].join(", ")}`,
                workspaceKind: kind,
            });
        }
    }
    return out;
}
/** Extract YAML frontmatter delimited by `---` lines. The opening `---`
 *  must be on the first line. Returns the frontmatter body (between the
 *  delimiters) when found. */
function extractFrontmatter(raw) {
    if (!raw.startsWith("---"))
        return { found: false, body: "" };
    // Find the closing delimiter, allowing both LF and CRLF line endings.
    const lines = raw.split(/\r?\n/);
    if (lines[0].trim() !== "---")
        return { found: false, body: "" };
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === "---") {
            return { found: true, body: lines.slice(1, i).join("\n") };
        }
    }
    return { found: false, body: "" };
}
//# sourceMappingURL=frontmatter-validator.js.map