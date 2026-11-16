import { Command } from "commander";
import type { StatusDeps } from "./status.js";
export interface RigDeps extends StatusDeps {
    readFile: (path: string) => string;
}
export declare function rigCommand(depsOverride?: RigDeps): Command;
//# sourceMappingURL=rig.d.ts.map