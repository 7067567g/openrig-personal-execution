import os from "node:os";
import fs from "node:fs";
import nodePath from "node:path";
import { unpack } from "./bundle-archive.js";
// TODO: AS-T12 — migrate to pod-aware bundle types
import { parseLegacyBundleManifest as parseBundleManifest, validateLegacyBundleManifest as validateBundleManifest, normalizeLegacyBundleManifest as normalizeBundleManifest } from "./bundle-types.js";
import { resolvePackage } from "./package-resolve-helper.js";
import { isPathInsideRoot } from "./cwd-resolution.js";
import { getDefaultOpenRigPath } from "../openrig-compat.js";
/**
 * Resolves a .rigbundle archive into bootstrap-compatible sources.
 * Extracts, verifies, parses manifest, maps vendored packages.
 */
// TODO: AS-T12 — migrate to pod-aware bundle source resolver
export class LegacyBundleSourceResolver {
    fsOps;
    constructor(deps) {
        this.fsOps = deps.fsOps;
    }
    /**
     * Resolve a bundle archive into bootstrap-compatible sources.
     * Caller must call cleanup(tempDir) after use.
     */
    async resolve(bundlePath) {
        const tempDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), "rigbundle-"));
        try {
            // Extract + verify (archive digest + content integrity)
            await unpack(bundlePath, tempDir);
            // Parse bundle manifest
            const manifestPath = nodePath.join(tempDir, "bundle.yaml");
            if (!fs.existsSync(manifestPath)) {
                throw new Error("Extracted bundle missing bundle.yaml");
            }
            const manifestYaml = fs.readFileSync(manifestPath, "utf-8");
            const raw = parseBundleManifest(manifestYaml);
            // Validate manifest (path safety via isRelativeSafePath in validateBundleManifest)
            const validation = validateBundleManifest(raw, { requireIntegrity: false });
            if (!validation.valid) {
                throw new Error(`Invalid bundle manifest: ${validation.errors.join("; ")}`);
            }
            const manifest = normalizeBundleManifest(raw);
            // Locate rig spec — ensure resolved path stays within tempDir
            const specPath = nodePath.resolve(tempDir, manifest.rigSpec);
            if (!isPathInsideRoot(specPath, tempDir)) {
                throw new Error(`Rig spec path '${manifest.rigSpec}' escapes bundle workspace`);
            }
            if (!fs.existsSync(specPath)) {
                throw new Error(`Rig spec '${manifest.rigSpec}' not found in bundle`);
            }
            // Resolve vendored packages
            const resolvedPackages = [];
            const packageRefMap = {};
            for (const entry of manifest.packages) {
                // Ensure package path stays within tempDir
                const vendoredDir = nodePath.resolve(tempDir, entry.path);
                if (!isPathInsideRoot(vendoredDir, tempDir)) {
                    throw new Error(`Package path '${entry.path}' escapes bundle workspace`);
                }
                const result = resolvePackage(vendoredDir, undefined, this.fsOps);
                if (!result.ok) {
                    const errMsg = result.kind === "validation" ? result.errors.join("; ") : result.error;
                    throw new Error(`Failed to resolve vendored package '${entry.name}': ${errMsg}`);
                }
                resolvedPackages.push(result.resolved);
                // Map all original refs to this resolved package
                packageRefMap[entry.originalSource] = result.resolved;
                if (entry.originalSources) {
                    for (const src of entry.originalSources) {
                        packageRefMap[src] = result.resolved;
                    }
                }
                // Also map by vendored path (for local resolution)
                packageRefMap[entry.path] = result.resolved;
                packageRefMap[`./${entry.path}`] = result.resolved;
            }
            return { specPath, resolvedPackages, packageRefMap, manifest, tempDir };
        }
        catch (err) {
            // Clean up on failure
            this.cleanup(tempDir);
            throw err;
        }
    }
    /** Remove the temp extraction directory. */
    cleanup(tempDir) {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        catch {
            // Best-effort cleanup
        }
    }
}
// -- Pod-aware bundle source resolver (AgentSpec reboot) --
import { parsePodBundleManifest, validatePodBundleManifest, normalizeIncludedLoginFiles } from "./bundle-types.js";
/**
 * Resolves a pod-aware .rigbundle archive (schemaVersion 2).
 * Extracts, verifies manifest shape, returns paths for downstream resolution.
 */
export class PodBundleSourceResolver {
    async resolve(bundlePath) {
        const tempDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), "podbundle-"));
        try {
            // Safe unpack with digest/symlink/integrity verification
            await unpack(bundlePath, tempDir);
            const manifestPath = nodePath.join(tempDir, "bundle.yaml");
            if (!fs.existsSync(manifestPath)) {
                throw new Error("Bundle missing bundle.yaml manifest");
            }
            const raw = parsePodBundleManifest(fs.readFileSync(manifestPath, "utf-8"));
            const validation = validatePodBundleManifest(raw);
            if (!validation.valid) {
                throw new Error(`Invalid pod bundle manifest: ${validation.errors.join("; ")}`);
            }
            const m = raw;
            const manifest = {
                schemaVersion: 2,
                name: m["name"],
                version: m["version"],
                createdAt: m["created_at"],
                rigSpec: m["rig_spec"],
                agents: m["agents"].map((a) => ({
                    name: a["name"],
                    version: a["version"],
                    path: a["path"],
                    originalRef: a["original_ref"] ?? "",
                    hash: a["hash"],
                    importEntries: Array.isArray(a["import_entries"])
                        ? a["import_entries"].map((ie) => ({
                            name: ie["name"],
                            version: ie["version"],
                            path: ie["path"],
                            originalRef: ie["original_ref"] ?? "",
                            hash: ie["hash"],
                        }))
                        : [],
                })),
                cultureFile: m["culture_file"],
                includedLoginFiles: normalizeIncludedLoginFiles(m["included_login_files"]),
            };
            const specPath = nodePath.join(tempDir, manifest.rigSpec);
            if (!fs.existsSync(specPath)) {
                throw new Error(`Bundle missing rig spec at ${manifest.rigSpec}`);
            }
            return { specPath, manifest, tempDir };
        }
        catch (err) {
            this.cleanup(tempDir);
            throw err;
        }
    }
    cleanup(tempDir) {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        catch {
            // Best-effort cleanup
        }
    }
}
/**
 * Copy an extracted (already verified) pod bundle into a stable target root so
 * the rig launched from it keeps a live spec dir, agent refs and `cwd: "."`
 * after the temp extraction is removed.
 *
 * Refuses — writing nothing — when any bundle file would land on a path in the
 * target that holds different content (or a directory). Identical files are
 * left as they are, so re-installing the same bundle into the same target works.
 * For an explicitly requested stopped-team replacement, preserve conflicting
 * paths in the instance before writing the offered bundle. Other files stay put.
 */
export function materializePodBundle(extractedDir, targetRoot, preserveConflicts = false) {
    const files = [];
    (function walk(dir, prefix) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const rel = prefix ? nodePath.join(prefix, entry.name) : entry.name;
            if (entry.isDirectory())
                walk(nodePath.join(dir, entry.name), rel);
            else if (entry.isFile())
                files.push(rel);
        }
    })(extractedDir, "");
    const conflicts = new Set();
    for (const rel of files) {
        const dest = nodePath.join(targetRoot, rel);
        if (!preserveConflicts) {
            // Keep the existing first-install handling of identical linked files.
            const stat = fs.statSync(dest, { throwIfNoEntry: false });
            if (!stat) {
                let parent = nodePath.dirname(dest);
                while (parent.length > targetRoot.length && !fs.existsSync(parent))
                    parent = nodePath.dirname(parent);
                if (parent.length > targetRoot.length && !fs.statSync(parent).isDirectory())
                    conflicts.add(nodePath.relative(targetRoot, parent));
            }
            if (stat && (!stat.isFile() || !fs.readFileSync(dest).equals(fs.readFileSync(nodePath.join(extractedDir, rel)))))
                conflicts.add(rel);
            continue;
        }
        let blockedParent = false;
        const parts = rel.split(nodePath.sep);
        for (let i = 1; i < parts.length; i++) {
            const parentRel = nodePath.join(...parts.slice(0, i));
            const parent = fs.lstatSync(nodePath.join(targetRoot, parentRel), { throwIfNoEntry: false });
            if (!parent)
                break;
            if (!parent.isDirectory()) {
                conflicts.add(parentRel);
                blockedParent = true;
                break;
            }
        }
        if (blockedParent)
            continue;
        const stat = fs.lstatSync(dest, { throwIfNoEntry: false });
        if (!stat)
            continue;
        if (!stat.isFile() || !fs.readFileSync(dest).equals(fs.readFileSync(nodePath.join(extractedDir, rel)))) {
            conflicts.add(rel);
        }
    }
    if (conflicts.size > 0 && !preserveConflicts)
        return { ok: false, conflicts: [...conflicts] };
    let backupPath;
    let roots = [];
    if (conflicts.size > 0) {
        roots = [...conflicts].filter(rel => ![...conflicts].some(parent => rel.startsWith(parent + nodePath.sep)));
        const backupRoot = getDefaultOpenRigPath("bundle-backups");
        fs.mkdirSync(backupRoot, { recursive: true });
        backupPath = fs.mkdtempSync(nodePath.join(backupRoot, "reinstall-"));
        // A parent conflict owns all its descendants. Preserve the path itself,
        // including a symlink. Copy all originals before removing any; the instance
        // and target may be on different filesystems.
        fs.writeFileSync(nodePath.join(backupPath, "RESTORE.json"), JSON.stringify({ targetRoot, paths: roots }, null, 2));
        for (const rel of roots) {
            const dest = nodePath.join(backupPath, "files", rel);
            fs.mkdirSync(nodePath.dirname(dest), { recursive: true });
            try {
                fs.cpSync(nodePath.join(targetRoot, rel), dest, { recursive: true, dereference: false, verbatimSymlinks: true, preserveTimestamps: true, errorOnExist: true, force: false });
            }
            catch (error) {
                throw new Error(`Could not preserve target path ${rel}: ${error.message}. Originals were kept; partial backup is at ${backupPath}.`);
            }
        }
    }
    try {
        for (const rel of roots)
            fs.rmSync(nodePath.join(targetRoot, rel), { recursive: true });
        for (const rel of files) {
            const dest = nodePath.join(targetRoot, rel);
            if (fs.existsSync(dest))
                continue;
            fs.mkdirSync(nodePath.dirname(dest), { recursive: true });
            fs.copyFileSync(nodePath.join(extractedDir, rel), dest);
        }
    }
    catch (error) {
        throw new Error(`Bundle files may have been written to ${targetRoot}: ${error.message}.${backupPath ? ` Original files are preserved at ${backupPath}; see RESTORE.json.` : ""}`);
    }
    return { ok: true, ...(backupPath ? { backupPath } : {}) };
}
//# sourceMappingURL=bundle-source-resolver.js.map