import { Command } from "commander";
import type { StatusDeps } from "./status.js";
type IdentitySource = {
    nodeId?: string;
    sessionName?: string;
};
export interface HealthDeps extends StatusDeps {
    resolveIdentity: () => IdentitySource | null;
}
export declare function healthCommand(depsOverride?: HealthDeps): Command;
export {};
//# sourceMappingURL=health.d.ts.map