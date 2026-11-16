import type { CopyTerminal } from "../print-for-copy.js";
export interface SpecLaunch {
    source: string;
    folder: string;
    host: string;
}
export declare function launchArgs(launch: SpecLaunch): string[];
export declare function launchCommand(launch: SpecLaunch): string;
export interface LaunchProcess {
    executable: string;
    args: string[];
    env: NodeJS.ProcessEnv;
}
export declare function launchProcess(launch: SpecLaunch, endpoint: string, env: NodeJS.ProcessEnv, executable: string, prefix?: string[]): LaunchProcess;
export declare function spawnLaunch(command: LaunchProcess): Promise<number | null>;
/** Give rig up the real terminal, including its own prompts and partial/collision output.
 * Wait before restoring the TUI so its result is not erased or translated into a success claim. */
export declare function runSpecLaunch(d: {
    command: LaunchProcess;
    terminal: CopyTerminal;
    run?: typeof spawnLaunch;
    pauseInput(): void;
    resumeInput(): void;
    setSuspended(on: boolean): void;
    isShuttingDown(): boolean;
    notice(message: string): void;
    draw(): void;
}): Promise<void>;
//# sourceMappingURL=launch.d.ts.map