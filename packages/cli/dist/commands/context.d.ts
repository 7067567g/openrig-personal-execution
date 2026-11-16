import { Command } from "commander";
import type { StatusDeps } from "./status.js";
export declare function contextCommand(depsOverride?: StatusDeps & {
    preflightExec?: (cmd: string) => Promise<string>;
}): Command;
//# sourceMappingURL=context.d.ts.map