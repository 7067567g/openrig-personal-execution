import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// Four levels up from packages/daemon/{src,dist}/domain/ is the repo root in a source checkout. In the
// published package this file sits at @openrig-local/cli/daemon/dist/domain/, so the same walk lands in
// node_modules/@openrig-local/, where there is no mirror to check.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const MIRROR_SCRIPT = "scripts/mirror-skills.mjs";
export async function checkMirrorDriftSafe(repoRoot = REPO_ROOT) {
    const scriptPath = resolve(repoRoot, MIRROR_SCRIPT);
    if (!existsSync(scriptPath)) {
        return {
            ok: true,
            skipped: true,
            reason: `Mirror drift check skipped: no ${MIRROR_SCRIPT} under ${repoRoot}; it runs only in an OpenRig source checkout`,
        };
    }
    const sourceDir = resolve(repoRoot, "packages/daemon/specs/agents/shared/skills");
    const targetDir = resolve(repoRoot, "skills/_canonical");
    if (!existsSync(sourceDir)) {
        return { ok: false, reason: `Mirror source not found: ${sourceDir}` };
    }
    if (!existsSync(targetDir)) {
        return { ok: false, reason: `Mirror target not found: ${targetDir}` };
    }
    try {
        const mod = await import(pathToFileURL(scriptPath).href);
        const result = mod.checkModeAbsolute(sourceDir, targetDir);
        return { ok: true, skipped: false, stale: result.stale, changes: result.changes };
    }
    catch (err) {
        return { ok: false, reason: `Mirror drift check failed: ${err instanceof Error ? err.message : String(err)}` };
    }
}
//# sourceMappingURL=skill-mirror-drift.js.map