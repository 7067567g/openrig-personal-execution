/** The existing pod state scope; malformed and legacy names do not invent a pod. */
export declare function codexQueueStateRoot(sessionName: string, sharedDocsRoot: string): string | undefined;
/** Only called for the derived team default. No permission/config files are written. */
export declare function prepareCodexTeamWorkspace(sessionName: string, workspaceRoot: string, sharedDocsRoot: string, home: string): string[];
export type PrepareCodexTeamWorkspace = (sessionName: string) => string[];
/** A failed optional scope preparation leaves the existing launch available, with a warning. */
export declare function codexTeamWorkspaceArg(prepare: PrepareCodexTeamWorkspace | undefined, sessionName: string): string;
//# sourceMappingURL=codex-team-workspace.d.ts.map