import fs from "node:fs";
import { Hono } from "hono";
import { LegacyRigSpecCodec } from "../domain/rigspec-codec.js";
import { RigSpecCodec } from "../domain/rigspec-codec.js";
import { LegacyRigSpecSchema } from "../domain/rigspec-schema.js";
import { RigSpecSchema } from "../domain/rigspec-schema.js";
import { rigPreflight } from "../domain/rigspec-preflight.js";
import { RigNotFoundError } from "../domain/errors.js";
import { runSyncSite } from "../domain/sync-site-wrap.js";
import { runtimeVersionProbeCwd } from "../adapters/preflight-exec.js";
import { RigSpecParseError, validateRigSpecImport } from "../domain/spec-validation-service.js";
import { pathHeader } from "./path-headers.js";
export const rigspecImportRoutes = new Hono();
function getDeps(c) {
    return {
        exporter: c.get("rigSpecExporter"),
        instantiator: c.get("rigInstantiator"),
        preflight: c.get("rigSpecPreflight"),
        podInstantiator: c.get("podInstantiator"),
        rigRepo: c.get("rigRepo"),
    };
}
// GET /api/rigs/:rigId/spec -> YAML
export function handleExportYaml(c) {
    const rigId = c.req.param("rigId");
    const { exporter } = getDeps(c);
    try {
        const spec = exporter.exportRig(rigId);
        // Detect format: pod-aware RigSpec has `pods`, legacy has `schemaVersion`
        const isPodAware = "pods" in spec;
        const yaml = isPodAware
            ? RigSpecCodec.serialize(spec)
            : LegacyRigSpecCodec.serialize(spec);
        return new Response(yaml, {
            status: 200,
            headers: { "Content-Type": "text/yaml" },
        });
    }
    catch (err) {
        if (err instanceof RigNotFoundError) {
            return c.json({ error: err.message }, 404);
        }
        return c.json({ error: "Export failed" }, 500);
    }
}
// GET /api/rigs/:rigId/spec.json -> JSON
export function handleExportJson(c) {
    const rigId = c.req.param("rigId");
    const { exporter } = getDeps(c);
    try {
        const spec = exporter.exportRig(rigId);
        return c.json(spec);
    }
    catch (err) {
        if (err instanceof RigNotFoundError) {
            return c.json({ error: err.message }, 404);
        }
        return c.json({ error: "Export failed" }, 500);
    }
}
// POST /api/rigs/import -> instantiate from YAML
rigspecImportRoutes.post("/", async (c) => {
    const { instantiator, podInstantiator } = getDeps(c);
    const body = await c.req.text();
    let raw;
    try {
        raw = RigSpecCodec.parse(body);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return c.json({ error: message, errors: [message] }, 400);
    }
    const isPodAware = raw && typeof raw === "object" && Array.isArray(raw.pods);
    if (isPodAware) {
        const rigRoot = pathHeader(c, "X-Rig-Root");
        if (!rigRoot)
            return c.json({ error: "X-Rig-Root header required for pod-aware specs", code: "missing_rig_root" }, 400);
        const cwdOverride = pathHeader(c, "X-Cwd-Override") ?? undefined;
        const outcome = await podInstantiator.instantiate(body, rigRoot, { cwdOverride });
        if (!outcome.ok) {
            const status = outcome.code === "validation_failed" ? 400
                : outcome.code === "preflight_failed" ? 409
                    : outcome.code === "cycle_error" ? 400
                        // S5b final-fix F1: the running-name guard refusal is a conflict on the
                        // direct instantiation route too — never a 500 (map consistency).
                        : outcome.code === "rig_name_running" ? 409
                            // #141: an import refused because a same-name rig could not be confirmed stopped.
                            : outcome.code === "generation_unconfirmed" ? 409
                                // A Compose project conflict is an actionable request conflict, not a server failure.
                                : outcome.code === "compose_project_conflict" ? 409
                                    : 500;
            const body = outcome.code === "rig_name_running" || outcome.code === "generation_unconfirmed" || outcome.code === "compose_project_conflict"
                ? { ...outcome, error: outcome.message }
                : outcome;
            return c.json(body, status);
        }
        return c.json(outcome.result, 201);
    }
    // Legacy path
    let spec;
    try {
        spec = LegacyRigSpecSchema.normalize(raw);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return c.json({ error: message, errors: [message] }, 400);
    }
    const outcome = await instantiator.instantiate(spec);
    if (!outcome.ok) {
        const status = outcome.code === "validation_failed" ? 400
            : outcome.code === "preflight_failed" ? 409
                : outcome.code === "rig_name_running" ? 409
                    : 500;
        const body = outcome.code === "rig_name_running"
            ? { ...outcome, error: outcome.message }
            : outcome;
        return c.json(body, status);
    }
    return c.json(outcome.result, 201);
});
// POST /api/rigs/import/workspace -> apply only a validated workspace declaration
rigspecImportRoutes.post("/workspace", async (c) => {
    const { rigRepo } = getDeps(c);
    const targetRigId = c.req.header("X-Target-Rig-Id");
    if (!targetRigId) {
        return c.json({ ok: false, code: "target_rig_required", error: "X-Target-Rig-Id header required for workspace-only apply" }, 400);
    }
    const body = await c.req.text();
    let raw;
    try {
        raw = RigSpecCodec.parse(body);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return c.json({ ok: false, code: "validation_failed", errors: [message] }, 400);
    }
    const workspace = raw && typeof raw === "object" && !Array.isArray(raw)
        ? raw["workspace"]
        : undefined;
    if (workspace === undefined || workspace === null) {
        return c.json({ ok: false, code: "workspace_required", errors: ["workspace: required for workspace-only apply"] }, 400);
    }
    const validation = RigSpecSchema.validateWorkspace(workspace);
    if (!validation.valid) {
        return c.json({ ok: false, code: "validation_failed", errors: validation.errors }, 400);
    }
    const normalizedWorkspace = RigSpecSchema.normalizeWorkspace(workspace);
    if (!rigRepo.getRig(targetRigId)) {
        return c.json({ ok: false, code: "target_rig_not_found", error: `Rig not found: ${targetRigId}` }, 404);
    }
    const current = rigRepo.getRigWorkspace(targetRigId);
    const changed = JSON.stringify(current) !== JSON.stringify(normalizedWorkspace);
    if (changed)
        rigRepo.setRigWorkspace(targetRigId, normalizedWorkspace);
    return c.json({ rigId: targetRigId, changed, workspace: normalizedWorkspace });
});
// POST /api/rigs/import/materialize -> create rig topology without launching
rigspecImportRoutes.post("/materialize", async (c) => {
    const { podInstantiator } = getDeps(c);
    const body = await c.req.text();
    let raw;
    try {
        raw = RigSpecCodec.parse(body);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return c.json({ error: message, errors: [message] }, 400);
    }
    const isPodAware = raw && typeof raw === "object" && Array.isArray(raw.pods);
    if (!isPodAware) {
        return c.json({ error: "materialize-only requires a pod-aware RigSpec", code: "pod_aware_required" }, 400);
    }
    const rigRoot = pathHeader(c, "X-Rig-Root");
    if (!rigRoot)
        return c.json({ error: "X-Rig-Root header required for pod-aware specs", code: "missing_rig_root" }, 400);
    const targetRigId = c.req.header("X-Target-Rig-Id") ?? undefined;
    const cwdOverride = pathHeader(c, "X-Cwd-Override") ?? undefined;
    const outcome = await podInstantiator.materialize(body, rigRoot, { targetRigId, cwdOverride });
    if (!outcome.ok) {
        const status = outcome.code === "validation_failed" ? 400
            : outcome.code === "preflight_failed" ? 409
                : outcome.code === "target_rig_not_found" ? 404
                    : outcome.code === "materialize_conflict" ? 409
                        : outcome.code === "rig_name_running" ? 409
                            : 500;
        const body = outcome.code === "rig_name_running"
            ? { ...outcome, error: outcome.message }
            : outcome;
        return c.json(body, status);
    }
    return c.json(outcome.result, 201);
});
// POST /api/rigs/import/validate -> validate only (auto-detects format)
rigspecImportRoutes.post("/validate", async (c) => {
    const body = await c.req.text();
    try {
        return c.json(validateRigSpecImport(body));
    }
    catch (err) {
        if (!(err instanceof RigSpecParseError))
            throw err;
        return c.json({ valid: false, errors: [err.message] }, 400);
    }
});
// POST /api/rigs/import/preflight -> validate + preflight (auto-detects format)
rigspecImportRoutes.post("/preflight", async (c) => {
    const { preflight, podInstantiator } = getDeps(c);
    const body = await c.req.text();
    let raw;
    try {
        raw = RigSpecCodec.parse(body);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return c.json({ valid: false, errors: [message] }, 400);
    }
    const isPodAware = raw && typeof raw === "object" && Array.isArray(raw.pods);
    if (isPodAware) {
        const rigRoot = pathHeader(c, "X-Rig-Root");
        if (!rigRoot)
            return c.json({ ready: false, errors: ["X-Rig-Root header required for pod-aware specs"], warnings: [] }, 400);
        const cwdOverride = pathHeader(c, "X-Cwd-Override") ?? undefined;
        const fsOps = { readFile: (p) => fs.readFileSync(p, "utf-8"), exists: (p) => fs.existsSync(p) };
        const { execSync } = await import("node:child_process");
        const exec = async (cmd) => runSyncSite("rigspec.import.preflight", () => execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 10_000, cwd: runtimeVersionProbeCwd(cmd) }));
        const result = await rigPreflight({
            rigSpecYaml: body,
            rigRoot,
            cwdOverride,
            fsOps,
            skillsRoot: podInstantiator.resolveSkillsRoot?.(),
            exec,
        });
        return c.json(result);
    }
    // Legacy
    let spec;
    try {
        spec = LegacyRigSpecSchema.normalize(raw);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return c.json({ valid: false, errors: [message] }, 400);
    }
    const result = await preflight.check(spec);
    return c.json(result);
});
//# sourceMappingURL=rigspec.js.map