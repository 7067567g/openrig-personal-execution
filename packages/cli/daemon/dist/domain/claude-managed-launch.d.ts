import type Database from "better-sqlite3";
export interface ClaudeLaunchTarget {
    nodeId: string;
    cwd?: string;
    session?: string;
    pane?: string | null;
    /** A successor may have a reserved generation before its tenure is committed. */
    generation?: string;
}
export declare class ClaudeManagedLaunch {
    private readonly db;
    private readonly sessionEnv;
    private readonly rendererEnv;
    /** Reads one variable from a seat's tmux session environment (the daemon's tmux adapter). */
    private readonly readSessionEnv?;
    /** Where the daemon vendors its plugins; default is `plugins` under the OpenRig home (tests). */
    private readonly pluginsDir?;
    constructor(db: Database.Database, sessionEnv: Readonly<Record<string, string | undefined>>, rendererEnv: Readonly<NodeJS.ProcessEnv>, 
    /** Reads one variable from a seat's tmux session environment (the daemon's tmux adapter). */
    readSessionEnv?: ((session: string, key: string) => Promise<string | undefined>) | undefined, 
    /** Where the daemon vendors its plugins; default is `plugins` under the OpenRig home (tests). */
    pluginsDir?: string | undefined);
    /** Names the seat's rig and member declare in `env:`, plus any one-off `rig up --env` names the
     *  launch recorded on the tmux session. Their values are already in the pane shell, which is
     *  where `env -i` forwards them from. The launch keeps ownership of its own variables. */
    private seatEnvKeys;
    private target;
    /** Bootstrap shares prepare's stored-node cwd when the binding omits it. */
    boundCwd(nodeId: string): string;
    /** Bootstrap and the launched child must use the same native selection.
     * Unset config uses HOME/.claude.json; even an explicit default-looking
     * directory selects <configDir>/.claude.json instead (#154/#225).
     */
    configPaths(cwd: string): {
        configDir: string;
        statePath: string;
    };
    /** The state file under the daemon's own non-empty CLAUDE_CONFIG_DIR, or undefined when the daemon
     * selects none. Classic bootstrap provisions it in addition to HOME/.claude.json. */
    selectedStatePath(cwd: string): string | undefined;
    private context;
    prepare(request: ClaudeLaunchTarget, mode: string): Promise<{
        assertCurrent: () => void;
        command: (args: readonly string[], launchEnv?: Readonly<Record<string, string>>) => string;
        configDir: string;
        executable: string;
    }>;
}
//# sourceMappingURL=claude-managed-launch.d.ts.map