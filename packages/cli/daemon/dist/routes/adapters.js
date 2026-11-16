import { Hono } from "hono";
export const adaptersRoutes = new Hono();
function getDeps(c) {
    return {
        tmuxAdapter: c.get("tmuxAdapter"),
        cmuxAdapter: c.get("cmuxAdapter"),
    };
}
// GET /api/adapters/tmux/sessions
adaptersRoutes.get("/tmux/sessions", async (c) => {
    const { tmuxAdapter } = getDeps(c);
    const sessions = await tmuxAdapter.listSessions();
    return c.json(sessions);
});
// GET /api/adapters/cmux/status — live control probe on every request
adaptersRoutes.get("/cmux/status", async (c) => {
    const { cmuxAdapter } = getDeps(c);
    await cmuxAdapter.connect();
    return c.json(cmuxAdapter.getStatus());
});
//# sourceMappingURL=adapters.js.map