import { Command } from "commander";
export declare function configCommand(configPath?: string, deps?: {
    /** SWEEP-c test seam: is a daemon currently running? Production probes healthz. */
    probeDaemonRunning?: () => Promise<boolean>;
}): Command;
//# sourceMappingURL=config.d.ts.map