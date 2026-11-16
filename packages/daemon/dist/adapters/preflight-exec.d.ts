import type { ExecFn } from "./tmux.js";
/** Preserve healthy relative PATH lookup; use the executable's filesystem root
 * only when the daemon's inherited cwd is unavailable. Profile/config probes
 * and all other commands keep their existing context. */
export declare function runtimeVersionProbeCwd(cmd: string): string | undefined;
/** Production preflight only; callers still prefer an explicitly injected exec. */
export declare const execPreflightCommand: ExecFn;
/** The message for a version check that hit its time limit: the check and the limit, nothing from the runtime.
 *  Undefined for any other failure. */
export declare function runtimeProbeTimeout(err: unknown): string | undefined;
/** Do not echo a runtime's arbitrary output, environment, paths or stack trace.
 * Retain only bounded process status and recognisable failure categories. */
export declare function runtimeProbeFailure(err: unknown): string;
//# sourceMappingURL=preflight-exec.d.ts.map