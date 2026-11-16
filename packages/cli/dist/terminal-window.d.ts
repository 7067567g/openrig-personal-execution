import type { DaemonClient } from "./client.js";
import type { OpenViewResult } from "./commands/terminal.js";
export interface WindowDeps {
    platform: NodeJS.Platform;
    env: NodeJS.ProcessEnv;
    exists(file: string): boolean;
    exec(file: string, args: string[], timeoutMs?: number): Promise<string>;
    launch(file: string, args: string[]): Promise<void>;
    sleep(ms: number): Promise<void>;
    id(): string;
    herdrConfig(socketPath: string, columns?: number): string;
    /** Hosting terminal measurement also works for an agent shell tool with piped stdio. */
    columns?(): Promise<number | undefined>;
    notice?(message: string): void;
}
export declare function defaultWindowDeps(): WindowDeps;
/** Render the daemon's existing composition; never rediscover/relaunch kernel seats here. */
export declare function openTerminalWindow(client: DaemonClient, view: string, requestedProvider?: string, deps?: WindowDeps, expectedPlan?: string): Promise<OpenViewResult>;
//# sourceMappingURL=terminal-window.d.ts.map