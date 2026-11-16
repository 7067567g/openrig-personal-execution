import { Command } from "commander";
import type { StatusDeps } from "./status.js";
/**
 * `rig stream` — coordination primitive L1 commands (PL-004 Phase A).
 *
 * Backed by `/api/stream`. Operates only via the daemon HTTP API.
 * Does NOT touch the POC `rigx-stream-proto` filesystem state.
 */
export interface StreamDeps extends StatusDeps {
    fetchImpl?: typeof fetch;
}
export declare function streamCommand(depsOverride?: StreamDeps): Command;
//# sourceMappingURL=stream.d.ts.map