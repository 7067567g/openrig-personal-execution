import { Command } from "commander";
import { runFileCopy, type PlanDeps } from "../lib/file-transfer.js";
export interface FileCommandDeps extends PlanDeps {
    run?: typeof runFileCopy;
}
export declare function fileCommand(deps?: FileCommandDeps): Command;
//# sourceMappingURL=file.d.ts.map