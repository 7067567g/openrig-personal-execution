import type { ResolvedPackage, FsOps } from "./package-resolver.js";
export type ResolveResult = {
    ok: true;
    resolved: ResolvedPackage;
} | {
    ok: false;
    kind: "resolution";
    error: string;
} | {
    ok: false;
    kind: "validation";
    errors: string[];
};
/**
 * Two-step resolve: find manifest file, then parse+validate separately.
 * Keeps resolution errors (missing file) distinct from validation errors (bad schema).
 */
export declare function resolvePackage(sourceRef: string, cwd: string | undefined, fsOps: FsOps): ResolveResult;
//# sourceMappingURL=package-resolve-helper.d.ts.map