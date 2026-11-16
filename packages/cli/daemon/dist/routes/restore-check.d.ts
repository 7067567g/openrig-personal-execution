import { Hono } from "hono";
import { RestoreCheckService } from "../domain/restore-check-service.js";
import type { RigRepository } from "../domain/rig-repository.js";
import type { SnapshotRepository } from "../domain/snapshot-repository.js";
export declare const restoreCheckRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
/**
 * OPR.0.4.3.22 — build a RestoreCheckService wired to the live daemon
 * repositories. Extracted so the rig-status compose route can consume the SAME
 * restore-check readiness signal (RecoveryPlan) the `/api/restore-check` route
 * emits, rather than re-implementing it (ponytail: one restore-check, composed).
 */
export declare function createRestoreCheckService(rigRepo: RigRepository, snapshotRepo: SnapshotRepository): RestoreCheckService;
//# sourceMappingURL=restore-check.d.ts.map