import { Command } from "commander";
import type { StatusDeps } from "./status.js";
export interface ExportDeps extends StatusDeps {
    writeFile: (path: string, content: string) => void;
}
export declare function exportCommand(depsOverride?: ExportDeps): Command;
//# sourceMappingURL=export.d.ts.map