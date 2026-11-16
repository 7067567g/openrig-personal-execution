import { type InitializationConflict, type InitializationFsOps } from "./workspace/default-workspace-scaffold.js";
export interface OpenRigInstanceInitializationOptions {
    home: string;
    workspaceRoot?: string;
    contextRoot?: string;
    skillsRoot?: string;
    topologyRoot?: string;
    dryRun?: boolean;
    fs?: InitializationFsOps;
}
export interface OpenRigInstanceInitializationResult {
    ok: boolean;
    home: string;
    createdPaths: string[];
    conflicts: InitializationConflict[];
    dryRun: boolean;
}
export declare function openRigContextLibraryRoots(contextRoot: string): [string, string];
/** Reconcile one canonical OpenRig instance layout. This is the shared owner
 * for CLI setup and daemon first-start. It owns empty roots and config.json;
 * S01 owns workspace contents, S04 owns skill contents, and topology owns its
 * contents. */
export declare function ensureOpenRigInstance(options: OpenRigInstanceInitializationOptions): OpenRigInstanceInitializationResult;
export declare function formatInstanceInitializationConflicts(result: Pick<OpenRigInstanceInitializationResult, "conflicts">): string;
//# sourceMappingURL=instance-initialization.d.ts.map