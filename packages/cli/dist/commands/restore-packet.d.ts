import { Command } from "commander";
import { DaemonClient } from "../client.js";
import { type LifecycleDeps } from "../daemon-lifecycle.js";
export interface RestorePacketDeps {
    lifecycleDeps?: LifecycleDeps;
    clientFactory?: (url: string) => DaemonClient;
}
export declare function restorePacketCommand(depsOverride?: RestorePacketDeps): Command;
//# sourceMappingURL=restore-packet.d.ts.map