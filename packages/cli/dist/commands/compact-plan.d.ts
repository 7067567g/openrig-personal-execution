import { Command } from "commander";
import { DaemonClient } from "../client.js";
import { type LifecycleDeps } from "../daemon-lifecycle.js";
export interface CompactPlanDeps {
    lifecycleDeps: LifecycleDeps;
    clientFactory: (url: string) => DaemonClient;
}
export declare function compactPlanCommand(depsOverride?: CompactPlanDeps): Command;
//# sourceMappingURL=compact-plan.d.ts.map