import { Command } from "commander";
import { type LifecycleDeps, type ProcessLiveness } from "../daemon-lifecycle.js";
interface ProcessAliveDeps {
    signalCheck: (pid: number) => boolean;
    readProcessState: (pid: number) => string | null;
}
export declare function createIsProcessAlive(deps: ProcessAliveDeps): (pid: number) => boolean;
export type SignalOutcome = "sent" | "missing" | "not-permitted";
/** kill(pid, 0) as an outcome. POSIX: only ESRCH means no such process; EPERM means the process
 *  EXISTS but this shell may not signal it (another user's process, or a sandbox such as Codex's). */
export declare function signalProbe(pid: number, kill?: (pid: number, signal: 0) => unknown): SignalOutcome;
/** #275 — three-state liveness for status reads. Only a missing process (ESRCH) or a zombie is
 *  dead. A process that exists but cannot be inspected (EPERM, or `ps` cannot run, as inside
 *  Codex's macOS sandbox) is UNKNOWN, never dead: calling it dead turned a running daemon into
 *  `stale` before any health probe. The boolean createIsProcessAlive (start/stop) is unchanged. */
export declare function createProcessLiveness(deps: {
    signal: (pid: number) => SignalOutcome;
    readProcessState: (pid: number) => string | null;
}): (pid: number) => ProcessLiveness;
type ExecFile = (file: string, args: string[], options: {
    encoding: "utf-8";
}) => string;
export declare function readProcessState(pid: number, platform?: NodeJS.Platform, run?: ExecFile): string | null;
export declare function realDeps(): LifecycleDeps;
export declare function daemonCommand(depsOverride?: LifecycleDeps): Command;
export {};
//# sourceMappingURL=daemon.d.ts.map