import { Hono } from "hono";
export const askRoutes = new Hono();
askRoutes.post("/", async (c) => {
    const askService = c.get("askService");
    const body = await c.req.json();
    if (!body.rig || !body.question) {
        return c.json({ error: "Missing required fields: rig, question" }, 400);
    }
    const result = await askService.ask(body.rig, body.question, {
        nodeId: body.nodeId,
        sessionName: body.sessionName,
        seat: body.seat,
        session: body.session,
    });
    return c.json(result);
});
//# sourceMappingURL=ask.js.map