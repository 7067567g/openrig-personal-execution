export declare class ProjectReadError extends Error {
    readonly code: string;
    readonly candidates?: string[] | undefined;
    constructor(code: string, message: string, candidates?: string[] | undefined);
}
export declare function yamlObject(file: string): Record<string, any>;
/** The existing workspace.yaml catalog, shared by work-install and project reads. */
export declare function readProjectCatalog(catalogPath: string): Array<{
    id: string;
    root: string;
}> | null;
export declare function selectCatalogProject(catalogPath: string, selectedId?: string): {
    id: string;
    root: string;
} | null;
/** The rig of a canonical seat session (`member@rig`). Pod and member ids can't
 *  contain `@`, so the rig is everything after the first one. */
export declare function rigFromSession(sessionName: string | null | undefined): string | null;
export type CatalogInferenceBasis = "rig" | "cwd" | "unclaimed";
/** Steps 3-5 of project selection, used only where the catalog alone would stop
 *  with project_required: the calling rig's association (workspace.yaml
 *  `projects[].rigs`), then the unique deepest project root containing the
 *  working directory, then the only entry that no rig claims. The last keeps a
 *  user's own rigs on their project after a claimed project (a contributor
 *  bundle) is added beside it. None adds a refusal: an unusable signal is a
 *  warning, and no unique answer throws the original project_required.
 *  Shared by work-install and operating posture, so both pick the same project. */
export declare function inferCatalogProject(catalogPath: string, required: ProjectReadError, signals: {
    rigName?: string | null;
    cwd?: string | null;
}, warnings: string[]): {
    id: string;
    root: string;
    selectedBy: CatalogInferenceBasis;
};
/** Exact project membership; unscoped historical rows are not assigned to a selected project. */
export declare function belongsToProject(raw: string | null | undefined, id: string): boolean;
//# sourceMappingURL=project-catalog.d.ts.map