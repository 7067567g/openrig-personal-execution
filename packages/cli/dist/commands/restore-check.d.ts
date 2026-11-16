import { Command } from "commander";
import { DaemonClient } from "../client.js";
import { type LifecycleDeps } from "../daemon-lifecycle.js";
export interface RestoreCheckDeps {
    lifecycleDeps: LifecycleDeps;
    clientFactory: (url: string) => DaemonClient;
}
export declare function restoreCheckCommand(depsOverride?: RestoreCheckDeps): Command;
//# sourceMappingURL=restore-check.d.ts.map