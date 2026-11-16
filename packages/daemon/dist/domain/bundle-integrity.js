import { createHash } from "node:crypto";
import nodePath from "node:path";
import { parseLegacyBundleManifest as parseBundleManifest, normalizeLegacyBundleManifest as normalizeBundleManifest, serializeLegacyBundleManifest as serializeBundleManifest, normalizeIncludedLoginFiles } from "./bundle-types.js";
/** Files to ignore during integrity operations */
const IGNORE_FILES = new Set([".DS_Store", "Thumbs.db", ".gitkeep"]);
/** Reserved control files — not content, not extras */
const CONTROL_FILES = new Set(["bundle.yaml"]);
/** Sensitive path patterns that block bundle creation */
const SENSITIVE_PATTERNS = [
    /^\.env$/,
    /^\.env\..+$/,
    /\.env$/,
    /^credentials\./,
    /^tokens\./,
    /\.pem$/,
    /\.key$/,
    /\.p12$/,
    /^\.git\//,
    /^node_modules\//,
];
export function isHarnessLoginPath(relativePath) {
    return /(?:^|\/)(?:\.claude\/\.credentials\.json|\.codex\/auth\.json|\.pi\/agent\/auth\.json)$/.test(relativePath.split(nodePath.sep).join("/"));
}
export function harnessLoginMessage(relativePath, included = false) {
    return `${included ? "Credential-bearing bundle includes" : "Bundle refuses"} harness login file '${relativePath}': anyone with the bundle could read this login file. Remove it from the agent folder or carried project and build the bundle again, or, only if recipients should have this login (for example, your own internal test bundle) and its owner agrees, recreate with --include-login-files. ${included ? "The unsigned manifest records the producer's declaration, not trust or receiver approval." : "No file contents are shown."}`;
}
function includedLoginPaths(raw) {
    const paths = normalizeIncludedLoginFiles(raw) ?? [];
    if (paths.some(p => !isHarnessLoginPath(p) || /[*?]/.test(p)))
        throw new Error("included_login_files may name only exact harness login-file paths, never directories or wildcards");
    return new Set(paths);
}
export function isSensitivePath(relativePath, includedLoginFiles) {
    const name = nodePath.basename(relativePath);
    return SENSITIVE_PATTERNS.some((p) => p.test(name) || p.test(relativePath))
        || (isHarnessLoginPath(relativePath) && !includedLoginFiles?.has(relativePath));
}
function hashContent(content) {
    return createHash("sha256").update(content).digest("hex");
}
/**
 * Compute integrity hashes for all content files in a bundle directory.
 * Throws on sensitive paths. Excludes control files and OS junk.
 */
export function computeIntegrity(dir, fsOps, includedLoginFiles) {
    const included = includedLoginPaths(includedLoginFiles);
    const allFiles = fsOps.walkFiles(dir);
    const files = {};
    const sensitive = [];
    for (const relPath of allFiles) {
        const name = nodePath.basename(relPath);
        if (IGNORE_FILES.has(name))
            continue;
        if (CONTROL_FILES.has(relPath))
            continue;
        if (isSensitivePath(relPath, included)) {
            sensitive.push(isHarnessLoginPath(relPath) ? harnessLoginMessage(relPath) : relPath);
            continue;
        }
        const fullPath = nodePath.join(dir, relPath);
        const content = fsOps.readFileBuffer(fullPath);
        files[relPath] = hashContent(content);
    }
    if (sensitive.length > 0) {
        throw new Error(`Sensitive paths detected in bundle: ${sensitive.join(", ")}`);
    }
    return { algorithm: "sha256", files };
}
/**
 * Write integrity section into bundle.yaml, then write bundle.yaml.sha256 digest.
 */
export function writeIntegrity(dir, integrity, fsOps) {
    const manifestPath = nodePath.join(dir, "bundle.yaml");
    const yaml = fsOps.readFile(manifestPath);
    const raw = parseBundleManifest(yaml);
    const manifest = normalizeBundleManifest(raw);
    manifest.integrity = integrity;
    const updatedYaml = serializeBundleManifest(manifest);
    fsOps.writeFile(manifestPath, updatedYaml);
}
/**
 * Verify bundle integrity. Checks manifest digest first, then per-file hashes.
 */
export function verifyIntegrity(dir, manifest, fsOps) {
    const result = {
        passed: true,
        mismatches: [],
        missing: [],
        extra: [],
        errors: [],
    };
    // Verify content file integrity (manifest trust is P7-T03's archive-level responsibility)
    if (!manifest.integrity) {
        result.passed = false;
        result.errors.push("manifest has no integrity section");
        return result;
    }
    let included;
    try {
        included = includedLoginPaths(manifest.includedLoginFiles);
    }
    catch (err) {
        result.passed = false;
        result.errors.push(err.message);
        return result;
    }
    const expectedFiles = manifest.integrity.files;
    for (const file of included) {
        if (!Object.hasOwn(expectedFiles, file)) {
            result.passed = false;
            result.errors.push(`included_login_files path is not covered by integrity: '${file}'`);
        }
    }
    // Check expected files
    for (const [relPath, expectedHash] of Object.entries(expectedFiles)) {
        const fullPath = nodePath.join(dir, relPath);
        if (!fsOps.exists(fullPath)) {
            result.missing.push(relPath);
            result.passed = false;
            continue;
        }
        const actualHash = hashContent(fsOps.readFileBuffer(fullPath));
        if (actualHash !== expectedHash) {
            result.mismatches.push(relPath);
            result.passed = false;
        }
    }
    // Check for extra files + sensitive paths
    const allFiles = fsOps.walkFiles(dir);
    const expectedSet = new Set(Object.keys(expectedFiles));
    for (const relPath of allFiles) {
        const name = nodePath.basename(relPath);
        if (IGNORE_FILES.has(name))
            continue;
        if (CONTROL_FILES.has(relPath))
            continue;
        if (!expectedSet.has(relPath)) {
            result.extra.push(relPath);
            result.passed = false;
        }
        // Check for sensitive paths on install/verify path (not just create)
        if (isSensitivePath(relPath, included)) {
            result.errors.push(isHarnessLoginPath(relPath) ? harnessLoginMessage(relPath) : `Sensitive file detected: ${relPath}`);
            result.passed = false;
        }
    }
    if (included.size > 0)
        result.warnings = [...included].map(file => harnessLoginMessage(file, true));
    return result;
}
//# sourceMappingURL=bundle-integrity.js.map