export type RunnerRuntime = "pi" | "omp";
export interface PiSeatPaths {
    seatRoot: string;
    agentDir: string;
    sessionsDir: string;
    runnerStatePath: string;
}
export declare function piSeatPaths(stateRoot: string, sessionName: string): PiSeatPaths;
export declare const PI_RUNNER_READY_MARKER = "[pi-runner] READY";
export declare const PI_RUNNER_EXIT_MARKER = "[pi-runner] EXITED";
export declare const PI_RUNNER_ERROR_MARKER = "[pi-runner] ERROR";
export interface PiRunnerState {
    ready: boolean;
    /** Launch-attempt scope (guard fold, code-review qitem-20260707011908):
     *  the adapter mints a launchId per attempt, pre-writes a pending sidecar
     *  carrying it, and passes --launch-id to the runner; the runner stamps it
     *  into every sidecar write. Readiness/resume polls IGNORE any state whose
     *  launchId differs — durable artifacts from prior runner instances can
     *  never false-green a new launch or false-fail it with a stale exit. */
    launchId?: string;
    /** Absolute session-file path from RPC get_state — the resume token. */
    sessionFile?: string;
    /** UUIDv7 session id from get_state — display/fallback metadata. */
    sessionId?: string;
    /** Durable catch-up cursor: last session-entry id projected to the bus. */
    lastEntryId?: string;
    /** ISO timestamp of the last sidecar write. */
    updatedAt: string;
    /** Set when the pi process exited; the seat is honestly non-running. */
    exited?: {
        code: number | null;
        at: string;
    };
}
/** The launch-scoped pending record every writer uses when resetting the
 *  sidecar for a new attempt. It deliberately CARRIES the prior lastEntryId:
 *  the durable catch-up cursor (FR-5) must survive the stale-artifact reset —
 *  erasing it broke get_entries-since on resume (guard re-verdict,
 *  qitem-20260707013815). Everything else from the prior record is exactly
 *  the stale state the reset exists to scope away. */
export declare function buildPendingRunnerState(launchId: string, updatedAt: string, prior: PiRunnerState | null): PiRunnerState;
export declare function parsePiRunnerState(raw: string): PiRunnerState | null;
export declare const PI_PROVIDER_ENV_VARS: Record<string, string>;
/** Explicit OMP chat-provider credential names. Only the declared provider's
 *  key can cross into the child; arbitrary *_KEY variables are never forwarded. */
export declare const OMP_PROVIDER_ENV_VARS: Record<string, string>;
/** Providers whose credential is a (key, endpoint) PAIR. A gateway, proxy or
 *  compatible endpoint issues a key that is only valid against one base URL, so
 *  sending the key alone hands the seat an unusable credential. startup's
 *  KNOWN_PROVIDER_AUTH_ENV already makes this pairing for ANTHROPIC_BASE_URL and
 *  OPENAI_BASE_URL; those reach a seat's launch env but die at the child
 *  boundary below without an entry here.
 *
 *  Each entry is the provider's key variable with _API_KEY swapped for _BASE_URL
 *  (asserted in omp-runner tests). The bar for an entry is that OMP's CHAT
 *  provider reads that variable as an endpoint override: a base URL OMP holds
 *  as a fixed constant, or reads only in another package, earns none —
 *  forwarding it would do nothing, or would mislead someone pointing chat at a
 *  proxy. Extending this map is a reviewed change, never a convenience edit,
 *  and the other OMP providers deliberately have none. */
export declare const OMP_PROVIDER_EXTRA_ENV_VARS: Record<string, readonly string[]>;
export declare const PI_ENV_BASELINE_VARS: readonly ["PATH", "HOME", "USER", "LOGNAME", "TERM", "LANG", "LC_ALL", "SHELL", "TMPDIR"];
/** Model declaration: Pi accepts `--model provider/id`. The provider segment
 *  (before the first "/") selects the env passthrough var, if any. */
export declare function providerFromModel(model: string | undefined): string | null;
/** Build the deny-by-default env for the pi child process (BR-3). `source` is
 *  the runner's own env; only allowlisted names cross the boundary. */
export declare function buildPiChildEnv(source: Record<string, string | undefined>, opts: {
    agentDir: string;
    sessionsDir: string;
    model?: string;
    runtime?: RunnerRuntime;
    sessionName?: string;
    nodeId?: string;
    openrigHome?: string;
    openrigUrl?: string;
}): Record<string, string>;
export interface PiRunnerLaunchOpts {
    /** Explicit runtime; omitted keeps the original Pi command byte-for-byte. */
    runtime?: RunnerRuntime;
    /** Absolute path to the compiled runner entry (daemon dist). */
    runnerEntryPath: string;
    /** The seat's canonical session name (identity + sidecar key). */
    sessionName: string;
    /** Seat state root (the <stateRoot> piSeatPaths derives from). */
    stateRoot: string;
    /** Managed working directory for the Pi session. */
    cwd: string;
    /** Optional `provider/id` model declaration (FR-7). */
    model?: string;
    /** Explicit posture; OMP maps it to --approval-mode, Pi to resource trust. */
    trust: "approve" | "no-approve";
    /** Exact session file to resume (FR-6). Mutually exclusive with forkRef. */
    sessionFile?: string;
    /** OPR.0.7.0.2: Pi only — the runner reports usage facts from persisted entries (usage.pi_cost_facts). */
    usageFacts?: boolean;
    /** OPR.0.7.0.2 K4: Pi only, with usageFacts — the runner looks up OpenRouter's charge (usage.pi_openrouter_charge). */
    openRouterCharge?: boolean;
    /** Session file path or id to fork from via CLI --fork (FR-6). */
    forkRef?: string;
    /** Launch-attempt scope stamped into every runner sidecar write. */
    launchId: string;
}
/** The command typed into the seat's tmux pane. The runner owns everything
 *  past this boundary (pi spawn, env allowlist, RPC, mirror, sidecar). */
export declare function buildPiRunnerCommand(opts: PiRunnerLaunchOpts): string;
/** Argv for the `pi` child the RUNNER spawns (argv-style, no shell). The
 *  explicit `--session-dir` wins over env per Pi's documented precedence —
 *  both are set so the isolation holds even if one layer regresses. */
export declare function buildPiChildArgs(opts: {
    sessionsDir: string;
    sessionName: string;
    model?: string;
    trust: "approve" | "no-approve";
    sessionFile?: string;
    forkRef?: string;
    runtime?: RunnerRuntime;
}): string[];
//# sourceMappingURL=pi-runner-protocol.d.ts.map