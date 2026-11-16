import { Hono } from "hono";
export const wakeResolveRoutes = new Hono();
// L3b — resolve a seat[@generation] to a resume token (or a refuse-and-teach
// listing) for `rig ask --wake <seat>`. Read-only; no execution here (the CLI
// runs the wake with the returned token).
wakeResolveRoutes.post("/", async (c) => {
    const svc = c.get("wakeResolveService");
    const body = await c.req.json().catch(() => ({}));
    if (!body.seat) {
        return c.json({ error: "Missing required field: seat" }, 400);
    }
    return c.json(svc.resolve(body.seat, body.generation));
});
//# sourceMappingURL=wake-resolve.js.map