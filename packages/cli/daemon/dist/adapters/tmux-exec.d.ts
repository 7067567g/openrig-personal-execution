import { type ChildProcessWithoutNullStreams } from "node:child_process";
import type { ArgvExecFn, ExecFn } from "./tmux.js";
export declare const TMUX_MAX_BUFFER: number;
/**
 * The first regular executable `name` on `pathEnv`, in execvp order. Null when there is none, or when an
 * entry before it is relative or empty: those depend on the cwd, so the bare name is left to the shell.
 */
export declare function resolveOnPath(name: string, pathEnv: string | undefined): string | null;
/**
 * Production ExecFn for TmuxAdapter.
 * Wraps child_process.exec (shell command string) and returns stdout.
 */
export declare const execCommand: ExecFn;
/**
 * Production ArgvExecFn for TmuxAdapter.
 * Runs argv[0] directly via execFile: no shell, no quoting layer. On POSIX
 * argv[0] is started by its resolved path: with a bare name, libuv tries each
 * PATH entry with a spawn on the event loop. psmux ships a `tmux` alias on
 * PATH, so Windows passes the bare name to the spawn.
 */
export declare const execArgvCommand: ArgvExecFn;
/**
 * Starts a long-lived tmux client (the daemon's control client, tmux-control.ts) as execArgvCommand starts tmux: the
 * file resolved on PATH, else, or when that file could not be started, `/bin/sh` once. Resolves once the process runs,
 * and rejects with the spawn error when even the shell could not start. POSIX only, as control mode is.
 */
export declare function spawnTmuxClient(args: string[]): Promise<ChildProcessWithoutNullStreams>;
//# sourceMappingURL=tmux-exec.d.ts.map