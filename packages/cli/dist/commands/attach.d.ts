import { Command } from "commander";
import type { StatusDeps } from "./status.js";
type TmuxExecFn = (cmd: string) => string;
export declare function resolveAttachContext(tmuxExec?: TmuxExecFn): {
    attachmentType: "external_cli";
} | {
    attachmentType: "tmux";
    tmuxSession: string;
    tmuxWindow?: string;
    tmuxPane: string;
};
export declare function attachCommand(depsOverride?: StatusDeps): Command;
export {};
//# sourceMappingURL=attach.d.ts.map