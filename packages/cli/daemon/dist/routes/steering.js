// Operator Surface Reconciliation v0 — steering composition route.
//
// Endpoint:
//   GET /api/steering — composed payload for the /steering UI surface.
//
// Per PRD § Item 1, returns priority-stack + roadmap-rail + lane-rails
// in a single payload. The UI fetches in-motion + loop-state from
// existing PL-005 endpoints and health gates from /api/health-summary
// (kept separate so the steering composer stays narrow + testable).
import { Hono } from "hono";
export function steeringRoutes() {
    const app = new Hono();
    app.get("/", (c) => {
        const composer = c.get("steeringComposer");
        if (!composer)
            return c.json({ error: "steering_composer_unavailable" }, 503);
        if (!composer.isReady()) {
            return c.json({
                error: "steering_workspace_not_configured",
                hint: "Run rig config init-workspace, or set workspace.steering_path / OPENRIG_STEERING_PATH for non-canonical layouts, then restart the daemon.",
            }, 503);
        }
        return c.json(composer.compose());
    });
    return app;
}
//# sourceMappingURL=steering.js.map