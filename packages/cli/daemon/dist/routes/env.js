import { Hono } from "hono";
function getDeps(c) {
    return {
        rigRepo: c.get("rigRepo"),
        serviceOrchestrator: c.get("serviceOrchestrator"),
        composeAdapter: c.get("composeAdapter"),
    };
}
export function envRoutes() {
    const app = new Hono();
    // GET /api/rigs/:rigId/env — env status with fresh receipt
    app.get("/", async (c) => {
        const rigId = c.req.param("rigId");
        if (!rigId)
            return c.json({ error: "Missing rigId" }, 400);
        const { rigRepo, serviceOrchestrator } = getDeps(c);
        const record = rigRepo.getServicesRecord(rigId);
        if (!record) {
            return c.json({ ok: true, hasServices: false });
        }
        // Refresh receipt with honest probe tracking
        let receipt = null;
        let probeStatus = "no_orchestrator";
        let probeError;
        if (record.latestReceiptJson) {
            try {
                receipt = JSON.parse(record.latestReceiptJson);
            }
            catch {
                probeError = "Cached service receipt could not be parsed";
            }
        }
        if (serviceOrchestrator) {
            try {
                const fresh = await serviceOrchestrator.captureReceipt(rigId);
                if (fresh) {
                    receipt = fresh;
                    probeStatus = "fresh";
                    probeError = undefined;
                }
                else {
                    probeStatus = "stale";
                    probeError = "Probe returned no receipt — services record may no longer exist";
                }
            }
            catch (err) {
                probeStatus = "stale";
                probeError = err.message;
            }
        }
        // Parse surfaces from specJson (best-effort)
        let surfaces = undefined;
        try {
            const spec = JSON.parse(record.specJson);
            if (spec["surfaces"])
                surfaces = spec["surfaces"];
        }
        catch { /* safe default */ }
        return c.json({
            ok: true,
            hasServices: true,
            kind: record.kind,
            composeFile: record.composeFile,
            projectName: record.projectName,
            receipt,
            probeStatus,
            ...(probeError ? { probeError } : {}),
            ...(surfaces ? { surfaces } : {}),
        });
    });
    // GET /api/rigs/:rigId/env/logs — service logs
    app.get("/logs", async (c) => {
        const rigId = c.req.param("rigId");
        if (!rigId)
            return c.json({ error: "Missing rigId" }, 400);
        const { rigRepo, composeAdapter } = getDeps(c);
        const record = rigRepo.getServicesRecord(rigId);
        if (!record) {
            return c.json({ error: "No services configured for this rig" }, 404);
        }
        if (!composeAdapter) {
            return c.json({ error: "Compose adapter not available" }, 500);
        }
        const service = c.req.query("service");
        const tailStr = c.req.query("tail");
        const tail = tailStr ? parseInt(tailStr, 10) : 100;
        let spec = {};
        try {
            spec = JSON.parse(record.specJson);
        }
        catch { /* empty */ }
        const result = await composeAdapter.logs({
            composeFile: record.composeFile,
            projectName: record.projectName,
            profiles: spec.profiles,
            service: service || undefined,
            tail,
        });
        if (!result.ok) {
            return c.json({ error: result.error }, 500);
        }
        return c.json({ ok: true, output: result.output });
    });
    // POST /api/rigs/:rigId/env/down — tear down services
    app.post("/down", async (c) => {
        const rigId = c.req.param("rigId");
        if (!rigId)
            return c.json({ error: "Missing rigId" }, 400);
        const { rigRepo, serviceOrchestrator } = getDeps(c);
        const record = rigRepo.getServicesRecord(rigId);
        if (!record) {
            return c.json({ error: "No services configured for this rig" }, 404);
        }
        if (!serviceOrchestrator) {
            return c.json({ error: "Service orchestrator not available" }, 500);
        }
        const body = await c.req.json().catch(() => null);
        const volumes = body?.volumes;
        const result = volumes === true
            ? await serviceOrchestrator.teardown(rigId, { policyOverride: "down_and_volumes" })
            : await serviceOrchestrator.teardown(rigId);
        if (!result.ok) {
            return c.json({ ok: false, error: result.error }, 500);
        }
        return c.json({ ok: true, ...(result.kept ? { kept: result.kept } : {}) });
    });
    return app;
}
//# sourceMappingURL=env.js.map