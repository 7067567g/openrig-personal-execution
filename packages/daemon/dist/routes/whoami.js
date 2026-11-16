import { Hono } from "hono";
import { WhoamiAmbiguousError } from "../domain/whoami-service.js";
export function whoamiRoutes() {
    const router = new Hono();
    router.get("/", (c) => {
        const svc = c.get("whoamiService");
        const nodeId = c.req.query("nodeId");
        const sessionName = c.req.query("sessionName");
        const targetRepo = c.req.query("targetRepo");
        // OPR.0.4.0.27: the CLI opts into compact (skips contextUsage/runtimeContext
        // compute). A direct /api/whoami with NO compact param stays FULL (API
        // back-compat for external consumers).
        const compact = c.req.query("compact") === "1";
        const permissionDiagnostics = c.req.query("diagnostics") === "permission";
        if (!nodeId && !sessionName) {
            return c.json({
                error: "Missing query parameter: provide nodeId or sessionName. Run rig ps --nodes to find available sessions.",
            }, 400);
        }
        try {
            const result = svc.resolve({
                nodeId: nodeId ?? undefined,
                sessionName: sessionName ?? undefined,
                targetRepoOverride: targetRepo ?? undefined,
                compact,
            });
            if (!result) {
                const identifier = nodeId ?? sessionName;
                return c.json({
                    error: `Session or node '${identifier}' not found in any managed rig. Check available sessions with: rig ps --nodes`,
                }, 404);
            }
            if (permissionDiagnostics) {
                const observer = c.get("permissionDriftObserver");
                if (observer)
                    result.permissionDrift = observer.diagnose(result.identity.nodeId);
            }
            return c.json(result);
        }
        catch (err) {
            if (err instanceof WhoamiAmbiguousError) {
                return c.json({ error: err.message }, 409);
            }
            return c.json({ error: err.message }, 500);
        }
    });
    return router;
}
//# sourceMappingURL=whoami.js.map