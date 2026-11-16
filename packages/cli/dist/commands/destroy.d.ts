import { Command } from "commander";
import { ConfigStore } from "../config-store.js";
import { type DestroyDeps } from "../destroy-helpers.js";
export interface DestroyCommandDeps {
    configStore: Pick<ConfigStore, "resolve">;
    destroyDeps: DestroyDeps;
}
export declare function destroyCommand(depsOverride?: DestroyCommandDeps): Command;
//# sourceMappingURL=destroy.d.ts.map