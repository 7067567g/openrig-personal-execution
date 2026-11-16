import { Command } from "commander";
import type { StatusDeps } from "./status.js";
import { loadHostRegistry } from "../host-registry.js";
import { runCrossHostCommand, type RunCrossHostCommandOpts } from "../cross-host-executor.js";
export interface CaptureDeps extends StatusDeps {
    hostRegistryLoader?: () => ReturnType<typeof loadHostRegistry>;
    crossHostRun?: (host: Parameters<typeof runCrossHostCommand>[0], argv: readonly string[], opts?: RunCrossHostCommandOpts) => ReturnType<typeof runCrossHostCommand>;
}
/**
 * The last `n` lines of a capture. The blank rows of the visible pane below its content are dropped first: on a
 * short shell pane the bottom rows are empty, and the last N rows would otherwise be all blank.
 */
export declare function lastLines(content: string, n: number): {
    content: string;
    lines: number;
    omittedLines: number;
};
/** When `--lines N` left earlier lines out, a busy seat's activity indicator (Claude draws its own above the input box)
 *  may be among them, so this capture can't say the seat is idle. It says unknown and names where activity is known.
 *  Capture never reported activity before, so no known fact is replaced. */
export declare const CUT_ACTIVITY_NOTE = "lines cut; busy or idle not shown here; see rig ps --nodes or --history-plus-pane";
export declare function captureCommand(depsOverride?: CaptureDeps): Command;
//# sourceMappingURL=capture.d.ts.map