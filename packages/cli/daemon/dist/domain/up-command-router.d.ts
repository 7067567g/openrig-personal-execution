export type SourceKind = "rig_spec" | "rig_bundle" | "rig_name" | "topology";
export interface RouteResult {
    sourceKind: SourceKind;
    sourceRef: string;
}
interface RouterFsOps {
    exists: (path: string) => boolean;
    readFile: (path: string) => string;
    readHead: (path: string, bytes: number) => Buffer;
}
/**
 * Routes a source path to the correct bootstrap pipeline based on
 * file extension or content-based auto-detection.
 */
export declare class UpCommandRouter {
    private fs;
    constructor(deps: {
        fsOps: RouterFsOps;
    });
    route(sourceRef: string): RouteResult;
    private validateYamlAsRigSpec;
    private autoDetect;
}
export {};
//# sourceMappingURL=up-command-router.d.ts.map