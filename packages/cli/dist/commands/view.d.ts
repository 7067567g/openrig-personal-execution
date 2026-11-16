import { Command } from "commander";
import type { StatusDeps } from "./status.js";
/**
 * `rig view` — coordination primitive L5 (view) commands (PL-004 Phase B).
 *
 * Backed by `/api/views`. 7 built-in views (recently-active, founder,
 * pod-load, escalations, held, activity, pickup) + custom view registration.
 * `escalations` carries both escalation-closed rows and the S01 wake-ladder's
 * open aggregated escalations (the operator rung's delivery floor).
 */
export interface ViewDeps extends StatusDeps {
}
export declare function viewCommand(depsOverride?: ViewDeps): Command;
//# sourceMappingURL=view.d.ts.map