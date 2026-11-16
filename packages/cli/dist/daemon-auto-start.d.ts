import type { LifecycleDeps, StartOptions } from "./daemon-lifecycle.js";
import type { PreflightResult } from "./system-preflight.js";
/** The configuration and preflight shared by local command auto-starts. */
export declare function prepareDaemonAutoStart(deps: LifecycleDeps, preflightExec?: (cmd: string) => Promise<string>): Promise<{
    options: StartOptions;
    preflight: PreflightResult;
}>;
//# sourceMappingURL=daemon-auto-start.d.ts.map