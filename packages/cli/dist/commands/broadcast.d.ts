import { Command } from "commander";
import type { StatusDeps } from "./status.js";
import { loadHostRegistry } from "../host-registry.js";
export interface BroadcastDeps extends StatusDeps {
    /** Test seam: inject a registry loader so no real ~/.openrig is touched. */
    hostRegistryLoader?: () => ReturnType<typeof loadHostRegistry>;
}
export declare function broadcastCommand(depsOverride?: BroadcastDeps): Command;
//# sourceMappingURL=broadcast.d.ts.map