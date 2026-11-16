import nodePath from "node:path";
import { createHash } from "node:crypto";
import { parseManifest, validateManifest, normalizeManifest } from "./package-manifest.js";
/**
 * Two-step resolve: find manifest file, then parse+validate separately.
 * Keeps resolution errors (missing file) distinct from validation errors (bad schema).
 */
export function resolvePackage(sourceRef, cwd, fsOps) {
    const absoluteRef = nodePath.isAbsolute(sourceRef)
        ? sourceRef
        : nodePath.resolve(cwd ?? process.cwd(), sourceRef);
    const manifestPath = nodePath.join(absoluteRef, "package.yaml");
    if (!fsOps.exists(manifestPath)) {
        return { ok: false, kind: "resolution", error: `No package.yaml found at ${manifestPath}` };
    }
    let rawYaml;
    try {
        rawYaml = fsOps.readFile(manifestPath);
    }
    catch (err) {
        return { ok: false, kind: "resolution", error: err.message };
    }
    let raw;
    try {
        raw = parseManifest(rawYaml);
    }
    catch (err) {
        return { ok: false, kind: "resolution", error: err.message };
    }
    const validation = validateManifest(raw);
    if (!validation.valid) {
        return { ok: false, kind: "validation", errors: validation.errors };
    }
    const manifest = normalizeManifest(raw);
    const manifestHash = createHash("sha256").update(rawYaml).digest("hex");
    return {
        ok: true,
        resolved: {
            sourceKind: "local_path",
            sourceRef: absoluteRef,
            manifest,
            manifestHash,
            rawManifestYaml: rawYaml,
        },
    };
}
//# sourceMappingURL=package-resolve-helper.js.map