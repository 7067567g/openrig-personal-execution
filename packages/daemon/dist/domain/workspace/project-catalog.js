import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "yaml";
export class ProjectReadError extends Error {
    code;
    candidates;
    constructor(code, message, candidates) {
        super(message);
        this.code = code;
        this.candidates = candidates;
    }
}
export function yamlObject(file) {
    try {
        const value = parse(fs.readFileSync(file, "utf8"));
        if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error("expected a YAML object");
        return value;
    }
    catch (err) {
        throw new ProjectReadError("workspace_catalog_invalid", `${file}: ${err.message}`);
    }
}
/** The existing workspace.yaml catalog, shared by work-install and project reads. */
export function readProjectCatalog(catalogPath) {
    if (!fs.existsSync(catalogPath))
        return null;
    const entries = yamlObject(catalogPath).projects;
    if (!Array.isArray(entries) || entries.some(e => !e || typeof e.id !== "string" || typeof e.root !== "string"))
        throw new ProjectReadError("workspace_catalog_invalid", `${catalogPath} projects must each declare string id and root values`);
    const ids = entries.map(e => e.id);
    const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
    if (duplicate)
        throw new ProjectReadError("project_identity_ambiguous", `project id '${duplicate}' names multiple roots in ${catalogPath}`);
    return entries.map(e => ({ id: e.id, root: e.root }));
}
export function selectCatalogProject(catalogPath, selectedId) {
    const projects = readProjectCatalog(catalogPath);
    if (!projects)
        return null;
    const candidates = projects.map(p => p.id);
    const id = selectedId ?? (projects.length === 1 ? projects[0].id : undefined);
    if (!id)
        throw new ProjectReadError("project_required", "multiple projects are declared; select one with --project", candidates);
    const selected = projects.find(p => p.id === id);
    if (!selected)
        throw new ProjectReadError("project_not_found", `project '${id}' is not declared in ${catalogPath}`, candidates);
    const nominal = path.resolve(path.dirname(catalogPath), selected.root);
    try {
        return { id, root: fs.realpathSync(nominal) };
    }
    catch {
        throw new ProjectReadError("project_root_missing", `project '${id}' root does not exist: ${nominal}`);
    }
}
/** The rig of a canonical seat session (`member@rig`). Pod and member ids can't
 *  contain `@`, so the rig is everything after the first one. */
export function rigFromSession(sessionName) {
    const at = sessionName?.indexOf("@") ?? -1;
    return at > 0 && at < sessionName.length - 1 ? sessionName.slice(at + 1) : null;
}
function catalogEntries(catalogPath) {
    try {
        const value = yamlObject(catalogPath).projects;
        return Array.isArray(value) ? value : [];
    }
    catch {
        return [];
    }
}
function canonicalExisting(file) {
    try {
        return fs.realpathSync(file);
    }
    catch {
        return null;
    }
}
function inside(root, file) {
    const rel = path.relative(root, file);
    return rel === "" || (!path.isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${path.sep}`));
}
function selectInferred(catalogPath, id, selectedBy) {
    const selected = selectCatalogProject(catalogPath, id);
    if (!selected)
        throw new ProjectReadError("project_not_found", `project '${id}' is not declared in ${catalogPath}`);
    return { ...selected, selectedBy };
}
/** Steps 3-5 of project selection, used only where the catalog alone would stop
 *  with project_required: the calling rig's association (workspace.yaml
 *  `projects[].rigs`), then the unique deepest project root containing the
 *  working directory, then the only entry that no rig claims. The last keeps a
 *  user's own rigs on their project after a claimed project (a contributor
 *  bundle) is added beside it. None adds a refusal: an unusable signal is a
 *  warning, and no unique answer throws the original project_required.
 *  Shared by work-install and operating posture, so both pick the same project. */
export function inferCatalogProject(catalogPath, required, signals, warnings) {
    const claims = new Map();
    const malformed = new Set();
    for (const entry of catalogEntries(catalogPath)) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry))
            continue;
        const { id, rigs } = entry;
        if (typeof id !== "string" || rigs === undefined)
            continue;
        if (!Array.isArray(rigs) || !rigs.every((name) => typeof name === "string")) {
            warnings.push(`${catalogPath}: project '${id}' rigs must be a list of rig names; ignored it`);
            malformed.add(id);
            continue;
        }
        claims.set(id, rigs);
    }
    const rig = signals.rigName ?? null;
    if (rig) {
        const claimants = [...claims].filter(([, rigs]) => rigs.includes(rig)).map(([id]) => id);
        if (claimants.length > 1) {
            throw new ProjectReadError("project_required", `rig '${rig}' is listed under several projects in ${catalogPath}; select one with --project`, claimants);
        }
        if (claimants.length === 1)
            return selectInferred(catalogPath, claimants[0], "rig");
    }
    const cwd = signals.cwd ? canonicalExisting(signals.cwd) : null;
    if (cwd) {
        const containing = [];
        for (const entry of readProjectCatalog(catalogPath) ?? []) {
            const root = canonicalExisting(path.resolve(path.dirname(catalogPath), entry.root));
            if (!root) {
                warnings.push(`project '${entry.id}' root does not exist; skipped it for working-directory selection`);
                continue;
            }
            if (inside(root, cwd))
                containing.push({ id: entry.id, root, depth: root.split(path.sep).filter(Boolean).length });
        }
        const depth = Math.max(...containing.map((entry) => entry.depth));
        const deepest = containing.filter((entry) => entry.depth === depth);
        if (deepest.length === 1)
            return { id: deepest[0].id, root: deepest[0].root, selectedBy: "cwd" };
        if (deepest.length > 1) {
            throw new ProjectReadError("project_required", `the working directory is inside several projects with the same root; select one with --project`, deepest.map((entry) => entry.id));
        }
    }
    const unclaimed = (readProjectCatalog(catalogPath) ?? [])
        .filter((entry) => !malformed.has(entry.id) && (claims.get(entry.id) ?? []).length === 0);
    if (unclaimed.length === 1)
        return selectInferred(catalogPath, unclaimed[0].id, "unclaimed");
    throw required;
}
/** Exact project membership; unscoped historical rows are not assigned to a selected project. */
export function belongsToProject(raw, id) {
    try {
        const tags = JSON.parse(raw ?? "null");
        return Array.isArray(tags) && tags.flatMap(t => typeof t === "string" ? t.split(",").map(s => s.trim()) : []).includes(`project:${id}`);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=project-catalog.js.map