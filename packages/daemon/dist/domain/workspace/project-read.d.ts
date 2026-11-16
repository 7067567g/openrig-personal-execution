export interface ProjectRead {
    id: string;
    root: string;
    name: string;
    sourcePath: string | null;
    missionsRoot: string;
    error?: string;
}
type ReadContext = {
    get: (key: never) => unknown;
    req: {
        query: (key: string) => string | undefined;
    };
};
export declare function projectCatalogPaths(c: Pick<ReadContext, "get">): {
    workspace: string;
    catalog: string;
};
export declare function insideProject(root: string, target: string): string;
export declare function workSource(root: string, dir: string, validate?: boolean): string;
export declare function listProjects(c: Pick<ReadContext, "get">): {
    catalogPath: string;
    projects: ProjectRead[];
};
/** One catalog project by id, resolved as `?project=` selection resolves it, without requiring its sources to be readable. */
export declare function declaredProject(c: Pick<ReadContext, "get">, id: string): ProjectRead;
/** One catalog project by id, with the same resolution and checks as `?project=` selection. */
export declare function projectById(c: Pick<ReadContext, "get">, id: string): ProjectRead;
export declare function selectedProject(c: ReadContext): ProjectRead | null;
export declare function projectReadResponse(err: unknown): Response;
export declare function projectMission(p: ProjectRead, mission: string): string;
export {};
//# sourceMappingURL=project-read.d.ts.map