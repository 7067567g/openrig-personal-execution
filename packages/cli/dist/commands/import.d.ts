import { Command } from "commander";
import type { StatusDeps } from "./status.js";
export interface ImportDeps extends StatusDeps {
    readFile: (path: string) => string;
}
export declare function importCommand(depsOverride?: ImportDeps): Command;
//# sourceMappingURL=import.d.ts.map