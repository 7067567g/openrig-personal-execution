import { selectCatalogProject, inferCatalogProject, rigFromSession, ProjectReadError } from "../../daemon/dist/project-catalog-surface.js";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parse as parseYaml } from "yaml";
import { projectMissionsRoot, readFrontmatter, resolveNodeFile } from "./scope/scope-fs.js";
import { readProjectSkillSelection } from "../../daemon/dist/skill-loadout-surface.js";
import { parseContextSelection, resolveSystemWorld, } from "../../daemon/dist/system-world-surface.js";
import { LifecycleManifestValidationError, validateMissionComposition, } from "../../daemon/dist/project-lifecycle-surface.js";
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
function failure(code, message, candidates) {
    return { error: { code, message, ...(candidates ? { candidates } : {}) } };
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function readYaml(path) {
    try {
        const value = parseYaml(readFileSync(path, "utf-8"));
        return isRecord(value) ? { value } : { value: null, error: `${path} must contain a YAML object` };
    }
    catch (err) {
        return { value: null, error: `${path} is not valid YAML: ${err.message}` };
    }
}
function canonicalExisting(path) {
    try {
        return realpathSync(path);
    }
    catch {
        return null;
    }
}
function inside(root, path) {
    const rel = relative(root, path);
    return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
}
function markdownPath(address) {
    const path = address.split("#", 1)[0];
    if (path.length === 0 ||
        isAbsolute(path) ||
        path.split(/[\\/]/).some((segment) => segment.length === 0 || segment === "." || segment === "..") ||
        ![".md", ".markdown"].includes(extname(path).toLowerCase())) {
        return null;
    }
    return path;
}
function piece(altitude, address, root, source) {
    const rel = markdownPath(address.slice(address.indexOf(":") + 1));
    if (!rel)
        return failure("invalid_markdown_address", `${address} must be a relative Markdown address inside its selected root`);
    const nominalPath = resolve(root, rel);
    if (!inside(root, nominalPath)) {
        return failure("address_escape", `${address} resolves outside its selected ${altitude} root`);
    }
    if (existsSync(nominalPath)) {
        const canonicalPath = canonicalExisting(nominalPath);
        if (canonicalPath && !inside(root, canonicalPath)) {
            return failure("address_escape", `${address} resolves through a symlink outside its selected ${altitude} root`);
        }
    }
    return { altitude, address, path: nominalPath, exists: existsSync(nominalPath), source };
}
/** install.worlds: each entry uses the System World selection shape. An invalid
 *  entry, or a ref already listed (by the System World or earlier in the list), is
 *  ignored with a warning; this never refuses the install. */
function readProjectWorlds(entries, systemRefs, warnings) {
    const worlds = [];
    const listed = new Set(systemRefs);
    entries.forEach((entry, index) => {
        const label = `project.yaml install.worlds[${index}]`;
        let selection;
        try {
            selection = parseContextSelection(entry, label);
        }
        catch (err) {
            warnings.push(`${err.message}; ignored that entry`);
            return;
        }
        if (listed.has(selection.ref)) {
            const where = systemRefs.has(selection.ref) ? "the System World" : "an earlier entry";
            warnings.push(`${label} repeats '${selection.ref}', already listed by ${where}; ignored that entry`);
            return;
        }
        listed.add(selection.ref);
        worlds.push(selection);
    });
    return worlds;
}
function manifestProjectId(manifest) {
    if (!manifest)
        return null;
    if (typeof manifest["id"] === "string")
        return manifest["id"];
    const metadata = manifest["metadata"];
    return isRecord(metadata) && typeof metadata["id"] === "string" ? metadata["id"] : null;
}
function resolveExplicitSlice(missionRoot, selection, declaredSliceRoots) {
    const slicesRoot = join(missionRoot, "slices");
    const available = [];
    const matches = [];
    if (existsSync(slicesRoot)) {
        for (const entry of readdirSync(slicesRoot, { withFileTypes: true })) {
            if (!entry.isDirectory() && !entry.isSymbolicLink())
                continue;
            const nominalRoot = join(slicesRoot, entry.name);
            const root = canonicalExisting(nominalRoot);
            if (!root || !inside(missionRoot, root)) {
                if (entry.name === selection) {
                    return failure("slice_root_escape", `slice '${selection}' resolves outside the selected mission root`);
                }
                continue;
            }
            if (declaredSliceRoots && !declaredSliceRoots.has(root))
                continue;
            available.push(entry.name);
            const nodeFile = resolveNodeFile(root);
            const frontmatter = nodeFile ? readFrontmatter(nodeFile) : {};
            const declaredId = frontmatter["id"] ?? frontmatter["dotId"];
            if (entry.name === selection || declaredId === selection) {
                matches.push({ root, name: entry.name });
            }
        }
    }
    available.sort();
    matches.sort((a, b) => a.name.localeCompare(b.name));
    if (matches.length === 0) {
        return failure("slice_not_found", `slice '${selection}' is not a child of the selected mission`, available);
    }
    if (matches.length > 1) {
        return failure("slice_identity_ambiguous", `slice '${selection}' names multiple children of the selected mission`, matches.map((match) => match.name));
    }
    return matches[0];
}
export function resolveWorkPosition(opts) {
    if (opts.project !== undefined && !SEGMENT.test(opts.project)) {
        return failure("invalid_project", "project must be a single bounded segment");
    }
    if (opts.mission !== undefined && !SEGMENT.test(opts.mission)) {
        return failure("invalid_mission", "mission must be a single bounded segment");
    }
    if (opts.slice !== undefined && !SEGMENT.test(opts.slice)) {
        return failure("invalid_slice", "slice must be a single bounded segment");
    }
    if (opts.slice !== undefined && opts.mission === undefined) {
        return failure("mission_required", "slice requires an exact mission selection");
    }
    const workspaceRoot = canonicalExisting(opts.workspaceRoot);
    if (!workspaceRoot) {
        return failure("workspace_root_missing", `workspace root does not exist: ${resolve(opts.workspaceRoot)}`);
    }
    const warnings = [];
    const systemWorld = resolveSystemWorld({
        contextRoot: opts.contextRoot,
        selection: opts.systemWorldSelection,
        source: opts.systemWorldSource,
    });
    if (!systemWorld.ok)
        return failure(systemWorld.error.code, systemWorld.error.message);
    const catalogPath = resolve(opts.catalogPath ?? join(workspaceRoot, "workspace.yaml"));
    let projectId = null;
    let projectRoot = workspaceRoot;
    let selectedBy = opts.project !== undefined ? "explicit" : "workspace";
    try {
        const selected = selectCatalogProject(catalogPath, opts.project);
        if (selected) {
            projectId = selected.id;
            projectRoot = selected.root;
            if (opts.project === undefined)
                selectedBy = "single";
        }
    }
    catch (err) {
        if (!(err instanceof ProjectReadError))
            throw err;
        if (err.code !== "project_required")
            return failure(err.code, err.message, err.candidates);
        try {
            ({ id: projectId, root: projectRoot, selectedBy } = inferCatalogProject(catalogPath, err, { rigName: rigFromSession(opts.sessionName), cwd: opts.cwd }, warnings));
        }
        catch (inferErr) {
            if (!(inferErr instanceof ProjectReadError))
                throw inferErr;
            return failure(inferErr.code, inferErr.message, inferErr.candidates);
        }
    }
    const projectManifestPath = join(projectRoot, "project.yaml");
    let projectManifest = null;
    if (existsSync(projectManifestPath)) {
        const parsed = readYaml(projectManifestPath);
        if (parsed.value)
            projectManifest = parsed.value;
        else
            warnings.push(`${parsed.error}; ignored optional enrichment and kept conventional addresses`);
    }
    const declaredProjectId = manifestProjectId(projectManifest);
    if (projectId && declaredProjectId && projectId !== declaredProjectId) {
        return failure("project_identity_conflict", `selected project '${projectId}' conflicts with project.yaml identity '${declaredProjectId}' at ${projectRoot}`);
    }
    if (!projectId) {
        if (opts.project && declaredProjectId !== opts.project) {
            return failure("project_not_found", `project '${opts.project}' cannot be resolved from the uncatalogued workspace`);
        }
        projectId = opts.project ?? declaredProjectId;
    }
    const missionsRoot = projectMissionsRoot(projectRoot, projectManifest, warnings);
    if (!missionsRoot) {
        return failure("missions_root_escape", "project.yaml missions.root resolves outside the selected project root");
    }
    let projectIntent = "SPEC.md";
    let projectIntentSource = "default";
    let projectContext = [];
    let projectWorlds;
    const install = projectManifest?.["install"];
    let projectSkills = [];
    if (isRecord(install)) {
        if (install["intent"] !== undefined) {
            if (typeof install["intent"] === "string" && markdownPath(install["intent"])) {
                projectIntent = install["intent"];
                projectIntentSource = "manifest";
            }
            else {
                warnings.push("project.yaml: optional install.intent must be a relative Markdown address; kept the conventional project SPEC");
            }
        }
        if (install["context"] !== undefined) {
            if (Array.isArray(install["context"]) && install["context"].every((value) => typeof value === "string" && markdownPath(value))) {
                projectContext = install["context"];
            }
            else {
                warnings.push("project.yaml: optional install.context must be a list of relative Markdown addresses; ignored it");
            }
        }
        if (install["worlds"] !== undefined) {
            if (Array.isArray(install["worlds"])) {
                const systemRefs = new Set((systemWorld.manifest?.context ?? []).map((selection) => selection.ref));
                projectWorlds = readProjectWorlds(install["worlds"], systemRefs, warnings);
            }
            else {
                projectWorlds = [];
                warnings.push("project.yaml: optional install.worlds must be an ordered list of { ref, profiles } entries; ignored it");
            }
        }
    }
    try {
        projectSkills = readProjectSkillSelection(projectRoot);
    }
    catch (err) {
        return failure("project_skills_invalid", err.message);
    }
    const pieces = [];
    for (const [address, source] of [
        [projectIntent, projectIntentSource],
        ...projectContext.map((address) => [address, "manifest"]),
    ]) {
        const planned = piece("project", `project:${address}`, projectRoot, source);
        if ("error" in planned)
            return planned;
        pieces.push(planned);
    }
    let missionRoot = null;
    let sliceRoot = null;
    let sliceName = null;
    let frontier = "project";
    if (opts.mission !== undefined) {
        missionRoot = join(missionsRoot, opts.mission);
        if (existsSync(missionRoot)) {
            const canonicalMissionRoot = canonicalExisting(missionRoot);
            if (!canonicalMissionRoot || !inside(projectRoot, canonicalMissionRoot)) {
                return failure("mission_root_escape", `mission '${opts.mission}' resolves outside the selected project root`);
            }
            missionRoot = canonicalMissionRoot;
            frontier = "mission";
            let missionSpec = "SPEC.md";
            let missionSource = "default";
            let declaredSliceRoots;
            const missionManifestPath = join(missionRoot, "mission.yaml");
            if (existsSync(missionManifestPath)) {
                const parsed = readYaml(missionManifestPath);
                const composition = parsed.value?.["composition"];
                if (parsed.value && isRecord(composition) && "slices" in composition) {
                    try {
                        declaredSliceRoots = new Set(validateMissionComposition(parsed.value, missionManifestPath)
                            .map((member) => dirname(member.path)));
                    }
                    catch (error) {
                        const message = error instanceof LifecycleManifestValidationError
                            ? error.message
                            : `Mission composition validation failed: ${error.message}`;
                        return failure("mission_composition_invalid", message);
                    }
                }
                const markdown = isRecord(composition) ? composition["mission_markdown"] : null;
                if (isRecord(markdown) && typeof markdown["spec"] === "string" && markdownPath(markdown["spec"])) {
                    missionSpec = markdown["spec"];
                    missionSource = "manifest";
                }
                else if (!parsed.value) {
                    warnings.push(`${parsed.error}; kept the conventional mission SPEC`);
                }
            }
            const plannedMission = piece("mission", `mission:${missionSpec}`, missionRoot, missionSource);
            if ("error" in plannedMission)
                return plannedMission;
            pieces.push(plannedMission);
            const plannedMissionProgress = piece("mission", "mission:PROGRESS.md", missionRoot, "default");
            if ("error" in plannedMissionProgress)
                return plannedMissionProgress;
            pieces.push(plannedMissionProgress);
            if (opts.slice !== undefined) {
                const selectedSlice = resolveExplicitSlice(missionRoot, opts.slice, declaredSliceRoots);
                if ("error" in selectedSlice)
                    return selectedSlice;
                sliceRoot = selectedSlice.root;
                sliceName = selectedSlice.name;
                frontier = "slice";
                let sliceSpec = "SPEC.md";
                let sliceSource = "explicit";
                const sliceManifestPath = join(sliceRoot, "slice.yaml");
                if (existsSync(sliceManifestPath)) {
                    const parsed = readYaml(sliceManifestPath);
                    const composition = parsed.value?.["composition"];
                    const markdown = isRecord(composition) ? composition["slice_markdown"] : null;
                    if (isRecord(markdown) && typeof markdown["spec"] === "string" && markdownPath(markdown["spec"])) {
                        sliceSpec = markdown["spec"];
                        sliceSource = "manifest";
                    }
                    else if (!parsed.value) {
                        warnings.push(`${parsed.error}; kept the conventional slice SPEC`);
                    }
                }
                const plannedSlice = piece("slice", `mission:slices/${sliceName}/${sliceSpec}`, missionRoot, sliceSource);
                if ("error" in plannedSlice)
                    return plannedSlice;
                pieces.push(plannedSlice);
                const plannedSliceProgress = piece("slice", `mission:slices/${sliceName}/PROGRESS.md`, missionRoot, "default");
                if ("error" in plannedSliceProgress)
                    return plannedSliceProgress;
                pieces.push(plannedSliceProgress);
            }
        }
    }
    return {
        position: {
            workspaceRoot,
            projectId,
            projectRoot,
            selectedBy,
            missionRoot,
            sliceRoot,
            mission: opts.mission ?? null,
            slice: sliceName ?? opts.slice ?? null,
            frontier,
        },
        pieces,
        systemWorld: {
            state: systemWorld.state,
            source: systemWorld.source,
            selection: systemWorld.selection,
            manifestPath: systemWorld.manifestPath,
            id: systemWorld.manifest?.id ?? null,
            version: systemWorld.manifest?.version ?? null,
            context: systemWorld.manifest?.context ?? [],
            skills: systemWorld.manifest?.skills ?? [],
        },
        ...(projectWorlds !== undefined ? { worlds: projectWorlds } : {}),
        skills: projectSkills,
        derive: [],
        warnings,
    };
}
//# sourceMappingURL=work-install.js.map