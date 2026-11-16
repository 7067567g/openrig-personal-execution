import { Command } from "commander";
import type { StatusDeps } from "./status.js";
export interface AgentDeps extends StatusDeps {
    readFile: (path: string) => string;
}
export declare function agentCommand(depsOverride?: AgentDeps): Command;
//# sourceMappingURL=agent.d.ts.map