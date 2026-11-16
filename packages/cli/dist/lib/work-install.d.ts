import { type SystemWorldContextSelection, type SystemWorldSource } from "@openrig-local/daemon/system-world";
export type WorkInstallSource = "explicit" | "manifest" | "default";
export type WorkInstallAltitude = "project" | "mission" | "slice";
/** How the project was chosen: --project, the only catalog entry, the calling
 *  rig's catalog association, the deepest catalog root containing the working
 *  directory, the only entry no rig claims, or the uncatalogued workspace itself. */
export type WorkInstallSelectedBy = "explicit" | "single" | "rig" | "cwd" | "unclaimed" | "workspace";
export interface WorkInstallPiece {
    altitude: WorkInstallAltitude;
    address: string;
    path: string;
    exists: boolean;
    source: WorkInstallSource;
}
export interface WorkInstallPlan {
    position: {
        workspaceRoot: string;
        projectId: string | null;
        projectRoot: string;
        selectedBy: WorkInstallSelectedBy;
        missionRoot: string | null;
        sliceRoot: string | null;
        mission: string | null;
        slice: string | null;
        frontier: WorkInstallAltitude;
    };
    pieces: WorkInstallPiece[];
    systemWorld: {
        state: "default" | "replacement" | "disabled";
        source: SystemWorldSource;
        selection: string;
        manifestPath: string | null;
        id: string | null;
        version: string | null;
        context: SystemWorldContextSelection[];
        skills: string[];
    };
    /** Ordered world packs from project.yaml install.worlds, after the System World.
     *  Present only when the project declares the key; listed, never delivered. */
    worlds?: SystemWorldContextSelection[];
    /** Project-world skill identities from project.yaml install.skills. */
    skills: string[];
    derive: [];
    warnings: string[];
}
export interface WorkInstallFailure {
    error: {
        code: string;
        message: string;
        candidates?: string[];
    };
}
export type WorkInstallResult = WorkInstallPlan | WorkInstallFailure;
export declare function resolveWorkPosition(opts: {
    workspaceRoot: string;
    catalogPath?: string;
    contextRoot: string;
    systemWorldSelection: string;
    systemWorldSource: SystemWorldSource;
    project?: string;
    mission?: string;
    slice?: string;
    /** Working directory for selection step 4 (the CLI passes --cwd or the process cwd). */
    cwd?: string;
    /** Calling seat's canonical session, for selection step 3; absent in a plain shell. */
    sessionName?: string;
}): WorkInstallResult;
//# sourceMappingURL=work-install.d.ts.map