export declare function workspaceScaffoldDirs(): string[];
export declare function workspaceScaffoldFiles(): Array<{
    relPath: string;
    content: string;
}>;
export type ManagedPathKind = "missing" | "file" | "directory" | "other";
export interface InitializationFsOps {
    pathKind(path: string): ManagedPathKind;
    mkdirp(path: string): void;
    writeFile(path: string, content: string): void;
}
export interface InitializationConflict {
    path: string;
    expected: "file" | "directory";
    actual: Exclude<ManagedPathKind, "missing">;
}
export interface InitWorkspaceResult {
    ok: boolean;
    root: string;
    rootCreated: boolean;
    subdirs: Array<{
        name: string;
        path: string;
        created: boolean;
    }>;
    files: Array<{
        relPath: string;
        absPath: string;
        created: boolean;
        skipped: "exists" | null;
    }>;
    conflicts: InitializationConflict[];
    dryRun: boolean;
}
export declare function nodeInitializationFs(): InitializationFsOps;
/** Additively reconcile the S01 project workspace. All collisions are found
 * before the first write, so a malformed user-owned path never leaves a
 * half-created scaffold. */
export declare function ensureDefaultWorkspace(options: {
    root: string;
    dryRun?: boolean;
    fs?: InitializationFsOps;
}): InitWorkspaceResult;
//# sourceMappingURL=default-workspace-scaffold.d.ts.map