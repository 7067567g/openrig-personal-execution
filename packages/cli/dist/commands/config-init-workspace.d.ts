import { Command } from "commander";
import { workspaceScaffoldDirs, workspaceScaffoldFiles, type InitWorkspaceResult } from "@openrig-local/daemon/instance-initialization";
export { workspaceScaffoldDirs, workspaceScaffoldFiles };
export type { InitWorkspaceResult };
export interface InitWorkspaceOpts {
    root?: string;
    /** Deprecated compatibility input. Existing files are always preserved. */
    force?: boolean;
    dryRun?: boolean;
    json?: boolean;
}
export declare function initWorkspaceCommand(configPath?: string): Command;
export declare function runInitWorkspace(opts: InitWorkspaceOpts & {
    configPath?: string;
}): InitWorkspaceResult;
//# sourceMappingURL=config-init-workspace.d.ts.map