import type { TmuxAdapter } from "../adapters/tmux.js";
export declare const SEAT_PUBLIC_ENV_KEYS: readonly ["OPENRIG_HOME", "OPENRIG_URL", "OPENRIG_HOST", "OPENRIG_PORT", "OPENRIG_NODE_ID", "OPENRIG_SESSION_NAME", "OPENRIG_RUNTIME", "OPENRIG_OCCUPANT_GENERATION", "OPENRIG_TRANSCRIPTS_LINES", "OPENRIG_TRANSCRIPTS_POLL_INTERVAL_SECONDS"];
export declare function publicSeatEnvironment(env: Readonly<Record<string, string | undefined>>): Record<string, string>;
/** Resolve exactly on the daemon launch PATH, without consulting the pane rc. */
export declare function launchExecutable(name: string, searchPath: string, cwd: string): string;
/** Reassert only public seat metadata after shell startup. Session identity is
 * read from tmux's launch environment; a successor's reserved identity wins.
 * Credentials stay in the inherited channel. An explicitly selected Codex home
 * is reasserted for Codex only; an unset selection retains the pane's defaults.
 */
export declare class SeatLaunchEnvironment {
    private readonly tmux;
    private readonly sessionEnv;
    private readonly daemonCwd;
    private readonly cliPath?;
    private readonly codexHome?;
    constructor(tmux: TmuxAdapter, sessionEnv: Readonly<Record<string, string | undefined>>, daemonCwd: string, cliPath?: string | undefined, codexHome?: string | undefined);
    private rigBin;
    command(session: string, command: string, target?: {
        codexCwd?: string;
        nodeId?: string;
        generation?: string;
        runtime?: string;
    }): Promise<string>;
}
//# sourceMappingURL=seat-launch-environment.d.ts.map