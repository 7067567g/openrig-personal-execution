import { stopGroup } from "../domain/codex-network-default.js";
import type { ExecFn } from "./tmux.js";
/** How long a runtime's `--version` or `--help` probe may take before it is ended and recorded as an error.
 *  Generous on purpose: a longer bound only costs time when a binary really hangs, and loaded hosts are unmeasured. */
export declare const RUNTIME_PROBE_TIMEOUT_MS = 30000;
/** A probe that didn't answer within its bound; its process group has been ended. */
export declare class ProbeTimeoutError extends Error {
    readonly command: string;
    readonly timeoutMs: number;
    /** The code Node gives a command that timed out, so failure classifiers read it like any other timeout. */
    readonly code = "ETIMEDOUT";
    constructor(command: string, timeoutMs: number);
}
/** End every probe still running: its whole process group, TERM then KILL, as the timeout path does. Probes that
 *  have finished are not in the set, so a normal probe is untouched. */
export declare function endRunningProbeGroups(graceMs?: number): Promise<void>;
/** The daemon is stopping: no probe starts from now on, and the ones running are ended. */
export declare function stopRuntimeProbes(graceMs?: number): Promise<void>;
/** While the daemon is still starting (the Codex probe runs before it listens, and the shutdown handlers aren't
 *  installed yet), end the probes' groups on SIGINT/SIGTERM and then die of the signal as before. Returns the
 *  disposer to call once the real shutdown handlers take over. */
export declare function endProbeGroupsOnStartupSignal(): () => void;
/** A probe the daemon's stop ended or refused: it has no result, and says nothing about the runtime. */
export declare class ProbeStoppedError extends Error {
    readonly command: string;
    readonly code = "ESTOPPED";
    constructor(command: string, why: "ended" | "refused");
}
/**
 * An ExecFn for runtime version and help probes, which must never hold up their caller (daemon startup awaits
 * one before it listens). Unlike execCommand: stdin is closed (a probe never needs input), the command runs in
 * its own process group, and after `timeoutMs` that whole group is ended (TERM, then KILL, then a bounded wait
 * for the reap; the Codex readers' stopGroup) and the promise rejects with ProbeTimeoutError. Where a group
 * can't be signalled (Windows), the probe process itself is then killed; its own descendants may survive there.
 * Otherwise it answers when the probe exits: what it wrote (after a short drain) on exit 0, or a rejection like
 * execCommand's on any other exit. Only if that 200 ms drain times out (the output pipes are still held open, by
 * a descendant) is the group ended then, so that descendant can't turn a finished probe into a timeout; a healthy
 * probe whose pipes end within the drain never reaches stopGroup. A descendant that closed its stdio is left
 * running, as execCommand leaves it.
 */
export declare function boundedProbeExec(timeoutMs?: number, graceMs?: number, deps?: {
    stopGroup?: typeof stopGroup;
    cwd?: (cmd: string) => string | undefined;
}): ExecFn;
//# sourceMappingURL=bounded-probe-exec.d.ts.map