import { Command } from "commander";
import { DaemonClient } from "../client.js";
import { type LifecycleDeps } from "../daemon-lifecycle.js";
export interface StatusDeps {
    lifecycleDeps: LifecycleDeps;
    clientFactory: (baseUrl: string) => DaemonClient;
}
export declare function statusCommand(depsOverride?: StatusDeps): Command;
//# sourceMappingURL=status.d.ts.map