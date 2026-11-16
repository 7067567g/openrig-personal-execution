import { Hono } from "hono";
import { SpecReviewError } from "../domain/spec-review-service.js";
export function specReviewRoutes() {
    const router = new Hono();
    router.post("/rig", async (c) => {
        const svc = c.get("specReviewService");
        const body = await c.req.json();
        if (!body.yaml) {
            return c.json({ error: "Missing required field: yaml" }, 400);
        }
        try {
            const review = svc.reviewRigSpec(body.yaml, body.sourceState ?? "draft");
            return c.json(review);
        }
        catch (err) {
            if (err instanceof SpecReviewError) {
                return c.json({ errors: err.errors }, 400);
            }
            return c.json({ error: err.message }, 500);
        }
    });
    router.post("/agent", async (c) => {
        const svc = c.get("specReviewService");
        const body = await c.req.json();
        if (!body.yaml) {
            return c.json({ error: "Missing required field: yaml" }, 400);
        }
        try {
            const review = svc.reviewAgentSpec(body.yaml, body.sourceState ?? "draft");
            return c.json(review);
        }
        catch (err) {
            if (err instanceof SpecReviewError) {
                return c.json({ errors: err.errors }, 400);
            }
            return c.json({ error: err.message }, 500);
        }
    });
    return router;
}
//# sourceMappingURL=spec-review.js.map