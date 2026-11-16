import { Hono } from "hono";
import type { ActivityEvidence } from "../domain/activity-taxonomy.js";
import type { AgentActivity } from "../domain/types.js";
/** Translate a recorded hook activity into oracle evidence. Returns null for states the
 *  oracle should not consume (unknown = noise, never evidence). needs_input becomes
 *  COUNT+reason on the hooks rung — never an activity value (the taxonomy's binding
 *  exclusion); the turn's working/idle stays whatever other evidence says. */
export declare function evidenceFromHookActivity(input: {
    seatNodeId: string;
    sessionName: string;
    runtime: string | null;
    activity: AgentActivity;
    seq: number;
}): ActivityEvidence | null;
export declare const activityRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=activity.d.ts.map