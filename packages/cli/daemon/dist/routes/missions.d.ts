import { Hono } from "hono";
export declare function missionsRoutes(): Hono;
/** Slice 18 §3.5 — parse the `status` field from the mission README's
 *  frontmatter. Returns the string when present (no enum validation —
 *  v0 callers care primarily about the "complete" value but other
 *  workflow states may appear), or null when the README is missing /
 *  the field is absent. Powers the durable storytelling-filter for
 *  Getting Started complete-and-hide. */
export declare function readMissionStatus(missionPath: string): string | null;
//# sourceMappingURL=missions.d.ts.map