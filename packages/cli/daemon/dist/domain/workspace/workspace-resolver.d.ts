import type { WorkspaceSpec, WorkspaceKind, NodeWorkspaceInfo } from "../types.js";
export interface WhoamiWorkspaceBlock {
    workspaceRoot: string;
    activeRepo: string | null;
    repos: Array<{
        name: string;
        path: string;
        kind: WorkspaceKind;
    }>;
    knowledgeRoot: string | null;
    knowledgeKind: WorkspaceKind | null;
}
export declare function resolveWorkspaceContext(opts: {
    spec: WorkspaceSpec | null;
    cwd: string | null;
    envOverride: string | null;
}): WhoamiWorkspaceBlock | null;
/** PL-007 — per-node workspace summary derived from a node's cwd against
 *  the rig's WorkspaceSpec. Used by NodeInventory. Returns null when the
 *  rig has no workspace declaration. */
export declare function resolveNodeWorkspace(opts: {
    spec: WorkspaceSpec | null;
    cwd: string | null;
}): NodeWorkspaceInfo | null;
//# sourceMappingURL=workspace-resolver.d.ts.map