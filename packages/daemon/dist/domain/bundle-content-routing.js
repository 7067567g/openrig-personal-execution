import fs from "node:fs";
import os from "node:os";
import nodePath from "node:path";
import { unpack } from "./bundle-archive.js";
import { parsePodBundleManifest } from "./bundle-types.js";
import { getDefaultOpenRigPath } from "../openrig-compat.js";
import { routeSkills } from "./bundle-skills-router.js";
import { routePlugins } from "./bundle-plugins-router.js";
import { routeWorkflowSpecs } from "./bundle-workflow-specs-router.js";
import { routeContextPacks } from "./bundle-context-packs-router.js";
import { routeAgentImages } from "./bundle-agent-images-router.js";
import { SettingsStore } from "./user-settings/settings-store.js";
import { parse as parseYaml } from "yaml";
import { registerBundleProject } from "./workspace/project-registration.js";
/** The message of anything thrown or rejected, including values that are not Errors (null, undefined, strings). */
export function thrownMessage(err) {
    return err instanceof Error ? err.message : String(err);
}
/** One human-readable warning per routing failure, for the result's warnings list. */
export function routingFailureWarnings(routing) {
    return (routing?.routingFailures ?? []).map((f) => `Bundle ${f.kind} routing failed: ${f.error}`);
}
function stringEntries(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((s) => typeof s === "string" && s.length > 0);
}
function pluginEntries(value) {
    if (!Array.isArray(value))
        return [];
    const declared = [];
    for (const entry of value) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry))
            continue;
        const p = entry;
        const s = p["source"];
        if (typeof p["id"] !== "string" || !p["id"])
            continue;
        if (!s || typeof s !== "object" || Array.isArray(s))
            continue;
        const src = s;
        if (src["kind"] !== "local" || typeof src["path"] !== "string" || !src["path"])
            continue;
        declared.push({ id: p["id"], source: { kind: "local", path: src["path"] } });
    }
    return declared;
}
/**
 * Extract the bundle once through the banked unpack trust boundary, then route
 * every declared kind. A kind the bundle does not declare is left out of the
 * result.
 */
export async function routeBundleContents(bundlePath, opts = {}) {
    const routing = {};
    const failures = [];
    const attempt = (kind, run) => {
        try {
            return run();
        }
        catch (err) {
            failures.push({ kind, error: thrownMessage(err) });
            return undefined;
        }
    };
    let tmpDir = null;
    try {
        const bundleRoot = fs.mkdtempSync(nodePath.join(os.tmpdir(), "bundle-content-route-"));
        tmpDir = bundleRoot;
        let manifest = null;
        try {
            await unpack(bundlePath, bundleRoot);
            const manifestPath = nodePath.join(bundleRoot, "bundle.yaml");
            if (fs.existsSync(manifestPath)) {
                manifest = parsePodBundleManifest(fs.readFileSync(manifestPath, "utf-8"));
            }
        }
        catch (err) {
            failures.push({ kind: "bundle", error: thrownMessage(err) });
        }
        if (manifest) {
            // Legacy declared skill files go to the package cache. S04 keeps this
            // package-shaped payload out of the managed skill catalog; importing a
            // complete harness skill into the catalog is a separate action.
            const declaredSkills = stringEntries(manifest["skills"]);
            if (declaredSkills.length > 0) {
                routing.skillsRouting = attempt("skills", () => routeSkills({ bundleRoot, declaredSkills, targetSkillsDir: getDefaultOpenRigPath("packages"), targetPrefixToStrip: "packages/" }, skillsRouterFsOps()));
            }
            const declaredPlugins = pluginEntries(manifest["plugins"]);
            if (declaredPlugins.length > 0) {
                routing.pluginsRouting = attempt("plugins", () => routePlugins({ bundleRoot, declaredPlugins, targetPluginsDir: getDefaultOpenRigPath("plugins") }, pluginsRouterFsOps()));
            }
            // Workflow specs go to <workspace specs root>/workflows, the path the
            // spec-library workflow scanner reads. SettingsStore is the sole
            // authority (see bundle-workflow-specs-router.ts).
            const declaredWorkflowSpecs = stringEntries(manifest["workflow_specs"]);
            if (declaredWorkflowSpecs.length > 0) {
                routing.workflowSpecsRouting = attempt("workflowSpecs", () => {
                    const workspaceSpecsRoot = new SettingsStore().resolveConfig().workspaceSpecsRoot;
                    if (!workspaceSpecsRoot)
                        throw new Error("workspace specs root is not configured");
                    return routeWorkflowSpecs({ bundleRoot, declaredWorkflowSpecs, targetWorkflowSpecsDir: nodePath.join(workspaceSpecsRoot, "workflows") }, workflowSpecsRouterFsOps());
                });
            }
            // Context packs go to context.root, exactly like the live
            // ContextPackLibraryService. A configured root replaces the default;
            // bundle routing must not silently create a second writable library.
            const declaredContextPacks = stringEntries(manifest["context_packs"]);
            if (declaredContextPacks.length > 0) {
                routing.contextPacksRouting = attempt("contextPacks", () => routeContextPacks({
                    bundleRoot,
                    declaredContextPacks,
                    targetContextPacksDir: new SettingsStore().resolveOne("context.root").value,
                }, contextPacksRouterFsOps()));
                if (routing.contextPacksRouting && opts.onContextPacksRouted) {
                    const rescan = opts.onContextPacksRouted;
                    const scan = attempt("contextPacks", () => rescan());
                    // A pack the live library rejects (for example a manifest without a version) is not usable,
                    // whatever the copy said: report the library's diagnostic for each pack routed here.
                    const routedDirs = routing.contextPacksRouting.records
                        .filter((r) => r.status === "routed" && r.installedAt)
                        .map((r) => r.installedAt);
                    for (const scanError of scan?.errors ?? []) {
                        if (routedDirs.some((dir) => scanError.source === dir || scanError.source.startsWith(dir + nodePath.sep))) {
                            failures.push({ kind: "contextPacks", error: `the context-pack library could not load ${scanError.source}: ${scanError.error}` });
                        }
                    }
                }
            }
            // The project this rig works in: registered in the workspace catalog with
            // this rig associated, so work-install resolves it at the first turn.
            const project = manifest["project"];
            if (project && typeof project === "object" && !Array.isArray(project)) {
                const { id, path: projectPath } = project;
                attempt("project", () => {
                    if (typeof id !== "string" || typeof projectPath !== "string")
                        throw new Error("bundle project entry needs an id and a path");
                    const rigSpec = parseYaml(fs.readFileSync(nodePath.join(bundleRoot, String(manifest["rig_spec"])), "utf-8"));
                    if (typeof rigSpec?.name !== "string")
                        throw new Error("bundle rig spec has no name");
                    const settings = new SettingsStore();
                    const result = registerBundleProject({
                        bundleProjectDir: nodePath.join(bundleRoot, projectPath),
                        projectId: id,
                        rigName: rigSpec.name,
                        projectsRoot: settings.resolveOne("workspace.projects_root").value,
                        workspaceRoot: settings.resolveOne("workspace.root").value,
                        catalogPath: settings.resolveOne("workspace.catalog_path").value,
                    });
                    routing.projectRegistration = result;
                    if (result.status === "conflict")
                        failures.push({ kind: "project", error: result.detail ?? "project registration conflict" });
                });
            }
            // Agent images are image DIRECTORIES under <openrigHome>/agent-images,
            // the root the live AgentImageLibraryService reads.
            const declaredAgentImages = stringEntries(manifest["agent_images"]);
            if (declaredAgentImages.length > 0) {
                routing.agentImagesRouting = attempt("agentImages", () => routeAgentImages({ bundleRoot, declaredAgentImages, targetAgentImagesDir: getDefaultOpenRigPath("agent-images") }, agentImagesRouterFsOps()));
            }
        }
    }
    catch (err) {
        failures.push({ kind: "bundle", error: thrownMessage(err) });
    }
    finally {
        if (tmpDir) {
            try {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
            catch { /* a leftover temp directory is not a routing failure */ }
        }
    }
    if (failures.length > 0)
        routing.routingFailures = failures;
    return routing;
}
function skillsRouterFsOps() {
    return {
        exists: (p) => fs.existsSync(p),
        copyFile: (s, d) => fs.copyFileSync(s, d),
        mkdirp: (p) => fs.mkdirSync(p, { recursive: true }),
    };
}
function pluginsRouterFsOps() {
    return {
        exists: (p) => fs.existsSync(p),
        isDirectory: (p) => { try {
            return fs.statSync(p).isDirectory();
        }
        catch {
            return false;
        } },
        mkdirp: (p) => fs.mkdirSync(p, { recursive: true }),
        copyDir: (s, d) => fs.cpSync(s, d, { recursive: true }),
    };
}
function workflowSpecsRouterFsOps() {
    return {
        exists: (p) => fs.existsSync(p),
        copyFile: (s, d) => fs.copyFileSync(s, d),
        mkdirp: (p) => fs.mkdirSync(p, { recursive: true }),
    };
}
function contextPacksRouterFsOps() {
    return {
        exists: (p) => fs.existsSync(p),
        isDirectory: (p) => { try {
            return fs.statSync(p).isDirectory();
        }
        catch {
            return false;
        } },
        readFile: (p) => fs.readFileSync(p, "utf8"),
        listFiles: (dir) => {
            const files = [];
            const walk = (current, prefix) => {
                for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
                    const child = nodePath.join(current, entry.name);
                    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
                    if (entry.isDirectory())
                        walk(child, relativePath);
                    else if (entry.isFile())
                        files.push(relativePath);
                }
            };
            walk(dir, "");
            return files;
        },
        mkdirp: (p) => fs.mkdirSync(p, { recursive: true }),
        copyDir: (s, d) => fs.cpSync(s, d, { recursive: true }),
    };
}
function agentImagesRouterFsOps() {
    return {
        exists: (p) => fs.existsSync(p),
        isDirectory: (p) => { try {
            return fs.statSync(p).isDirectory();
        }
        catch {
            return false;
        } },
        mkdirp: (p) => fs.mkdirSync(p, { recursive: true }),
        copyDir: (s, d) => fs.cpSync(s, d, { recursive: true }),
    };
}
//# sourceMappingURL=bundle-content-routing.js.map