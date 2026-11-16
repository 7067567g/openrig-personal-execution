import { Hono } from "hono";
import { HEALTH_SEVERITIES, HEALTH_STATUSES, } from "../domain/health-projection.js";
const SCOPE_TYPES = ["instance", "rig", "seat", "mission", "slice"];
export function healthRoutes() {
    const app = new Hono();
    app.get("/", (c) => {
        const service = c.get("healthProjection");
        if (!service)
            return c.json({ error: "health_projection_unavailable" }, 503);
        const scopeTypeRaw = c.req.query("scope_type");
        const scopeId = c.req.query("scope_id");
        if ((scopeTypeRaw === undefined) !== (scopeId === undefined)) {
            return c.json({ error: "scope_type and scope_id must be provided together" }, 400);
        }
        if (scopeTypeRaw !== undefined && !SCOPE_TYPES.includes(scopeTypeRaw)) {
            return c.json({ error: `scope_type must be one of: ${SCOPE_TYPES.join(", ")}` }, 400);
        }
        const severity = c.req.query("severity");
        if (severity !== undefined && !HEALTH_SEVERITIES.includes(severity)) {
            return c.json({ error: `severity must be one of: ${HEALTH_SEVERITIES.join(", ")}` }, 400);
        }
        const status = c.req.query("status");
        if (status !== undefined && !HEALTH_STATUSES.includes(status)) {
            return c.json({ error: `status must be one of: ${HEALTH_STATUSES.join(", ")}` }, 400);
        }
        const limitRaw = c.req.query("limit");
        const limit = limitRaw === undefined ? 100 : Number(limitRaw);
        try {
            return c.json(service.list({
                limit,
                scopeType: scopeTypeRaw,
                scopeId,
                severity: severity,
                status: status,
            }));
        }
        catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
        }
    });
    app.get("/:findingId", (c) => {
        const service = c.get("healthProjection");
        if (!service)
            return c.json({ error: "health_projection_unavailable" }, 503);
        const record = service.get(c.req.param("findingId"));
        return record ? c.json(record) : c.json({ error: "health_finding_not_found" }, 404);
    });
    return app;
}
//# sourceMappingURL=health.js.map