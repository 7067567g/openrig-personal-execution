export declare const MANAGED_BLOCK_START: (id: string) => string;
export declare const MANAGED_BLOCK_END: (id: string) => string;
export declare const CLAUDE_MANAGED_BLOCK_FILES: readonly ["CLAUDE.md", "CLAUDE.local.md"];
export type ClaudeManagedBlockFile = (typeof CLAUDE_MANAGED_BLOCK_FILES)[number];
export declare const DEFAULT_CLAUDE_MANAGED_BLOCK_FILE: ClaudeManagedBlockFile;
export interface ManagedBlockMergeFsOps {
    exists(path: string): boolean;
    readFile(path: string): string;
    writeFile(path: string, content: string): void;
    mkdirp?(path: string): void;
}
export interface ManagedBlockCleanupFsOps extends ManagedBlockMergeFsOps {
    deleteFile(path: string): void;
}
export interface MergeManagedBlockOptions {
    replaceBlockIds?: string[];
    warnings?: string[];
}
export declare function mergeManagedBlock(fs: ManagedBlockMergeFsOps, targetPath: string, blockId: string, content: string, options?: MergeManagedBlockOptions): void;
export declare function removeManagedBlocksFromFile(fs: ManagedBlockCleanupFsOps, targetPath: string): boolean;
export declare function stripManagedBlocks(content: string): string;
//# sourceMappingURL=managed-blocks.d.ts.map