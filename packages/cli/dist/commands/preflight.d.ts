import { Command } from "commander";
import { type DaemonStatus } from "../daemon-lifecycle.js";
interface PreflightCommandDeps {
    exec?: (cmd: string) => Promise<string>;
    configPath?: string;
    riggedHome?: string;
    getDaemonStatus?: () => Promise<DaemonStatus>;
}
export declare function preflightCommand(depsOverride?: PreflightCommandDeps): Command;
export {};
//# sourceMappingURL=preflight.d.ts.map