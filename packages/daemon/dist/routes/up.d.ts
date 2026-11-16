import { Hono } from "hono";
export declare const upRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
/**
 * OPR.0.3.2.CT — assemble the 3-part error response body
 * (fact / consequence / action) when a bootstrap result carries an
 * import_rig stage with status='blocked' and detail.code ===
 * 'attention_required'. Returns null when the result is not in that
 * shape (caller falls through to the normal partial-success path).
 *
 * Exported for narrow unit tests so the HG-4 shape is pinned without
 * needing the full daemon harness. Pure on the result shape.
 */
export declare function buildAttentionResponse(result: {
    rigId?: string;
    stages: Array<{
        stage: string;
        status: string;
        detail?: unknown;
    }>;
}): {
    error: {
        fact: string;
        consequence: string;
        action: string;
    };
    attentionNodes: import("../domain/types.js").AttentionNode[];
} | null;
//# sourceMappingURL=up.d.ts.map