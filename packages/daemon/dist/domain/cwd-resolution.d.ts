/** Expands a leading `~` and `$VAR` / `${VAR}` references. A reference to an unset variable is
 *  left as written so preflight reports the path instead of launching in a silently shortened one. */
export declare function expandCwd(authored: string, env?: NodeJS.ProcessEnv, home?: string): string;
/** Picks the directory an authored cwd means. The literal path wins when it exists, so a directory
 *  named with `~` or `$NAME` keeps its destination; otherwise the expanded path is used. A relative
 *  path resolves under `specRoot`; with no `specRoot` it stays relative, as the caller selected before. */
export declare function resolveAuthoredCwd(authored: string, specRoot: string | null, exists?: (path: string) => boolean, env?: NodeJS.ProcessEnv, home?: string): string;
export declare function resolveLaunchCwd(authoredCwd: string | null | undefined, specRoot: string, cwdOverride?: string | null): string;
export declare function getOpenRigInstallRoot(): string;
export declare function isPathInsideRoot(candidatePath: string, rootPath: string): boolean;
export declare function isFilesystemRoot(cwd: string): boolean;
export declare function getOpenRigInstallCwdError(resolvedCwd: string, cwdOverride?: string | null, installRoot?: string): string | null;
//# sourceMappingURL=cwd-resolution.d.ts.map