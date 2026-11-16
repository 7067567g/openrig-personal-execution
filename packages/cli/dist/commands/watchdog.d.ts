import { Command } from "commander";
import type { StatusDeps } from "./status.js";
/**
 * `rig watchdog` — coordination primitive Watchdog (PL-004 Phase C).
 *
 * Backed by `/api/watchdog`. Operates only via the daemon HTTP API.
 *
 * Per PRD § Watchdog: scheduler is daemon-native and joins the
 * supervision tree. Phase D includes workflow-keepalive alongside the
 * Phase C watchdog policies.
 */
export interface WatchdogDeps extends StatusDeps {
}
export declare function watchdogCommand(depsOverride?: WatchdogDeps): Command;
//# sourceMappingURL=watchdog.d.ts.map