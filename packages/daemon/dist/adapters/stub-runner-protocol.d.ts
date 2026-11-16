export declare const STUB_READINESS_SIDECAR_SUBPATH: string;
/** Absolute path to the readiness sidecar for a seat whose managed cwd is `cwd`. */
export declare function stubSeatSidecarPath(cwd: string): string;
export declare const STUB_SCRIPT_SUBPATH: string;
/** Absolute path to the scenario-resolved behavior script for a seat whose managed
 *  cwd is `cwd` (absent = the runner uses DEFAULT_STUB_SCRIPT). */
export declare function stubSeatScriptPath(cwd: string): string;
export declare const STUB_RUNNER_READY_MARKER = "[stub-runner] READY";
export declare const STUB_RUNNER_EXIT_MARKER = "[stub-runner] EXITED";
export declare const STUB_RUNNER_ERROR_MARKER = "[stub-runner] ERROR";
export interface StubRunnerState {
    /** True once the runner has come up; the daemon's positive readiness signal. */
    ready: boolean;
    /** Launch-attempt scope (Pi precedent): the adapter mints a launchId per attempt
     *  and passes --launch-id; the runner stamps it into every sidecar write so a
     *  durable artifact from a prior runner instance can never false-green a new
     *  launch. Optional so a minimal hand-written fixture still parses. */
    launchId?: string;
    /** Set when the stub process exited; the seat is honestly non-running. */
    exited?: {
        code: number | null;
        at?: string;
    };
    /** ISO timestamp of the last sidecar write (optional metadata). */
    updatedAt?: string;
}
/** Parse a readiness sidecar. Requires only `ready: boolean` (a minimal
 *  `{"ready": true}` fixture is valid); everything else is optional metadata. */
export declare function parseStubRunnerState(raw: string): StubRunnerState | null;
export interface StubRunnerLaunchOpts {
    /** Absolute path to the compiled runner entry (daemon dist). */
    runnerEntryPath: string;
    /** The seat's canonical session name (identity). */
    sessionName: string;
    /** Managed working directory (the readiness sidecar root). */
    cwd: string;
    /** Launch-attempt scope stamped into the runner's sidecar writes. */
    launchId: string;
    /** The seat's RESOLVED launch posture — byte-observable in the command on
     *  BOTH fresh and resume paths (floor is the usability default). */
    posture: "floor" | "full_bypass" | "auto";
    /** Exact resume token (a prior session marker) for the restore path. */
    resumeToken?: string;
}
/** The command typed into the seat's tmux pane. The runner owns everything past
 *  this boundary (sidecar write, behavior simulation, mirror). */
export declare function buildStubRunnerCommand(opts: StubRunnerLaunchOpts): string;
//# sourceMappingURL=stub-runner-protocol.d.ts.map