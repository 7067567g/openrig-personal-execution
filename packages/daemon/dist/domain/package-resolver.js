import path from "node:path";
import { createHash } from "node:crypto";
import { parseManifest, validateManifest, normalizeManifest, } from "./package-manifest.js";
export class PackageResolver {
    fs;
    constructor(fs) {
        this.fs = fs;
    }
    resolve(sourceRef, cwd) {
        // Resolve to absolute path
        const absoluteRef = path.isAbsolute(sourceRef)
            ? sourceRef
            : path.resolve(cwd ?? process.cwd(), sourceRef);
        const manifestPath = path.join(absoluteRef, "package.yaml");
        if (!this.fs.exists(manifestPath)) {
            throw new Error(`No package.yaml found at ${manifestPath}`);
        }
        const rawYaml = this.fs.readFile(manifestPath);
        const raw = parseManifest(rawYaml);
        const validation = validateManifest(raw);
        if (!validation.valid) {
            throw new Error(`Invalid manifest: ${validation.errors.join("; ")}`);
        }
        const manifest = normalizeManifest(raw);
        const manifestHash = createHash("sha256").update(rawYaml).digest("hex");
        return {
            sourceKind: "local_path",
            sourceRef: absoluteRef,
            manifest,
            manifestHash,
            rawManifestYaml: rawYaml,
        };
    }
}
//# sourceMappingURL=package-resolver.js.map