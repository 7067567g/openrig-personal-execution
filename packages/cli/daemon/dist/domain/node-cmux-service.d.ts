import type { RigRepository } from "./rig-repository.js";
import type { SessionRegistry } from "./session-registry.js";
import type { CmuxAdapter } from "../adapters/cmux.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
export type OpenCmuxAction = "focused_existing" | "created_new" | "created_helper";
export interface OpenCmuxResult {
    ok: boolean;
    action?: OpenCmuxAction;
    error?: string;
    code?: string;
}
export declare class NodeCmuxService {
    private rigRepo;
    private sessionRegistry;
    private cmuxAdapter;
    private tmuxAdapter;
    constructor(rigRepo: RigRepository, sessionRegistry: SessionRegistry, cmuxAdapter: CmuxAdapter, tmuxAdapter?: TmuxAdapter);
    openOrFocusNodeSurface(rigId: string, logicalId: string): Promise<OpenCmuxResult>;
    private createAndBindSurface;
    private resolveWorkspaceAnchor;
}
//# sourceMappingURL=node-cmux-service.d.ts.map