import type { ChildProcess } from "node:child_process";
import type { DaemonStartLock } from "./daemon-start-lock.js";
import type { InitWorkspaceResult, ManagedPathKind } from "@openrig-local/daemon/instance-initialization";
export interface DaemonState {
    pid: number;
    port: number;
    host?: string;
    db: string;
    startedAt: string;
}
/**
 * OPR.0.4.3.21 — event-loop wedge evidence read from the enriched `/healthz`
 * body. Present only when the daemon actually answered healthz with a monitor
 * wired; absent when healthz timed out (a wedged loop can't respond — the
 * evidence in that case is `reason: "unresponsive"`).
 */
export interface DaemonEventLoopEvidence {
    lagMeanMs: number;
    lagP99Ms: number;
    utilization: number;
    lastTickAgeMs: number;
    healthy: boolean;
}
export interface DaemonStatus {
    /** RULING 1ae863d2 — C3 3-state semantics (canonical: daemon crash-cart-detect.ts, kept in
     *  lockstep): "stopped" requires POSITIVE evidence (connection refused); a probe TIMEOUT or
     *  other non-refusal failure is "unverified" — never a down assertion. */
    state: "running" | "stopped" | "stale" | "unverified";
    /** Home-resolution honesty: set when the resolved home lacks daemon state but a live sibling
     *  home (or a HOME-MOVED marker) exists — callers name BOTH paths, never assert down. */
    siblingHint?: {
        resolvedHome: string;
        siblingHome: string;
    };
    port?: number;
    host?: string;
    pid?: number;
    healthy?: boolean;
    /**
     * OPR.0.4.3.21 — why an alive+listening daemon is unhealthy. "unresponsive"
     * = the process is up but `/healthz` timed out (the honest wedged-loop
     * signal); "event-loop-starved" = healthz answered but the loop-lag /
     * last-tick evidence crossed the threshold. Absent when healthy.
     */
    reason?: "unresponsive" | "event-loop-starved";
    /** OPR.0.4.3.21 — event-loop evidence when healthz answered with a monitor. */
    eventLoop?: DaemonEventLoopEvidence;
    /** #275 — the OS code behind a failed health probe (e.g. EPERM when a sandbox blocked it). */
    probeErrorCode?: string;
}
/** "unknown": the process may exist but this shell can neither signal nor inspect it. */
export type ProcessLiveness = "alive" | "dead" | "unknown";
export interface GetDaemonStatusOptions {
    /** Observers may disable cleanup; only a matching clean shutdown permits removal. */
    cleanupStaleState?: boolean;
}
/** Build the daemon HTTP URL from status. Uses persisted host or defaults to 127.0.0.1. */
export declare function getDaemonUrl(status: DaemonStatus): string;
/**
 * OPR.0.3.3.04.2 (AC-4): the ONE shared honest daemon-not-running error for the
 * daemon-dependent journey verbs (bootstrap / discover / workspace / workflow).
 * Mirrors the repo's 3-part fact / consequence / action convention
 * (commands/archive.ts, commands/queue.ts) so the daemon-dependency UX is
 * consistent across the new-operator journey instead of four divergent bare
 * dead-ends. Bounded to the daemon-not-running path - NOT a general
 * error-framework (that would be its own slice).
 */
export interface DaemonNotRunningError {
    fact: string;
    consequence: string;
    action: string;
    /** The OS code behind the failed probe, when known. */
    causeCode?: string;
}
export declare function daemonNotRunningError(): DaemonNotRunningError;
/**
 * Print the shared daemon-not-running error and set a failing exit code. Pass
 * `{ json: true }` for the agent-facing `{ error: { fact, consequence, action } }`
 * envelope (matching commands/queue.ts JSON output).
 */
/** B8-1b (shape 73ee4b25) — the epistemic-matched guard message: language derives from
 *  what the probe KNOWS. UNVERIFIED/unhealthy = "did not respond" (down ≠ busy);
 *  stopped/stale = the plain not-running truth. Pure so every surface shares it. */
export declare function statusGuardMessage(status: DaemonStatus): DaemonNotRunningError;
/** B8-1b — THE precheck chokepoint: returns true when the daemon is running+healthy;
 *  otherwise prints the epistemic-matched 3-part (+ the wrong-home sibling hint when
 *  present), sets exit 1, returns false. Replaces the ~55 hand-rolled verbatim guards. */
export declare function daemonStatusGuard(status: DaemonStatus, opts?: {
    json?: boolean;
}): boolean;
export declare function printDaemonNotRunning(opts?: {
    json?: boolean;
}): void;
export interface StartOptions {
    port?: number;
    host?: string;
    db?: string;
    transcriptsEnabled?: boolean;
    transcriptsPath?: string;
    /** When set, daemon startup idempotently ensures the default workspace exists. */
    workspaceRoot?: string;
    contextRoot?: string;
    skillsRoot?: string;
    topologyRoot?: string;
    transcriptsLines?: number;
    transcriptsPollIntervalSeconds?: number;
    skipKernelBoot?: boolean;
}
export interface LifecycleDeps {
    /** Required by startDaemon; read-only lifecycle consumers need no launch capability. */
    acquireStartLock?: () => DaemonStartLock;
    spawn: (cmd: string, args: string[], opts: {
        env: Record<string, string>;
        stdio: unknown;
        detached: boolean;
    }) => ChildProcess;
    fetch: (url: string) => Promise<{
        ok: boolean;
        json?: () => Promise<unknown>;
    }>;
    /** Exclusive bind check used only after a no-state health probe times out. */
    isPortOccupied?: (host: string, port: number) => Promise<boolean>;
    kill: (pid: number, signal: string) => boolean;
    readFile: (path: string) => string | null;
    fileSize?: (path: string) => number;
    readFileFrom?: (path: string, offset: number) => string | null;
    writeFile: (path: string, content: string) => void;
    removeFile: (path: string) => void;
    exists: (path: string) => boolean;
    mkdirp: (path: string) => void;
    /** Exact production path typing for additive initialization. Tests that do
     * not exercise collisions may omit it and use the legacy exists seam. */
    pathKind?: (path: string) => ManagedPathKind;
    openForAppend: (path: string) => number;
    closeFile?: (fd: number) => void;
    isProcessAlive: (pid: number) => boolean;
    /** #275 — three-state liveness for status reads (production: realDeps). Optional so existing
     *  mocks keep the boolean rule; absent = derived from isProcessAlive. */
    processLiveness?: (pid: number) => ProcessLiveness;
    sleep?: (ms: number) => Promise<void>;
    homeDir?: string;
    listDir?: (path: string) => string[];
}
export declare const OPENRIG_DIR: string;
export declare const RIGGED_DIR: string;
export declare const STATE_FILE: string;
export declare const LOG_FILE: string;
export declare const LEGACY_STATE_FILE: string;
export declare const LEGACY_LOG_FILE: string;
export type WorkspaceScaffoldResult = InitWorkspaceResult;
export declare function ensureWorkspaceScaffold(root: string, deps: LifecycleDeps): Promise<WorkspaceScaffoldResult>;
export declare function resolveCliBaseDir(baseDir: string): string;
/**
 * Pure resolver: prefers monorepo source when present (dev checkout
 * where `packages/daemon/dist` is the source of truth), falls back to
 * the bundled/vendored copy at `packages/cli/daemon` (the npm-install
 * layout).
 *
 * Why this order: in a monorepo dev checkout BOTH paths exist:
 *   - packages/daemon/dist                ← refreshed by
 *                                            `npm run build --workspace
 *                                            @openrig-local/daemon` (frequent;
 *                                            source of truth)
 *   - packages/cli/daemon/dist            ← refreshed only by
 *                                            `scripts/build-package.sh`
 *                                            (rare; for npm publish)
 *
 * Picking the vendored copy first (the prior order) means devs run a
 * stale daemon through `rig daemon start` whenever they've rebuilt
 * `@openrig-local/daemon` but haven't rerun `build-package.sh`. That hid the
 * fact that QA on local main 55e01f2e was getting a daemon WITHOUT the
 * shipped slice-09 `/api/rig-mode/*` routes (qitem-20260518054224).
 *
 * In an npm-install layout `packages/daemon/dist` does not exist
 * (only the bundled `packages/cli/daemon` lives next to the cli);
 * the fallback handles that case unchanged.
 */
export declare function resolveDaemonPath(baseDir: string, exists: (p: string) => boolean): string;
export declare function getDaemonPath(): string;
export declare function buildDaemonEnv(baseEnv: Record<string, string>, opts: {
    port: number;
    /**
     * Operator-explicit bind host. When undefined the CLI is signaling
     * "no operator opt-in" so the daemon's index.ts can fall through to
     * the default loopback+tailscale-auto multi-bind path (bug-fix slice
     * auth-bearer-tailscale-trust). When defined, the daemon takes the
     * explicit-host branch and applies the bearer invariant to it.
     * S20: when undefined, NO env fallback exists — inherited
     * OPENRIG_HOST/RIGGED_HOST are ROUTING state and are scrubbed by
     * ROUTING_ENV_SCRUB (the shell-level-opt-in premise died: injected
     * routing env is byte-indistinguishable from opt-in). The dedicated
     * OPENRIG_BIND_HOST is the only env opt-in and passes through.
     */
    host?: string;
    db: string;
    transcriptsEnabled?: boolean;
    transcriptsPath?: string;
    transcriptsLines?: number;
    transcriptsPollIntervalSeconds?: number;
    skipKernelBoot?: boolean;
}): Record<string, string>;
/** Resolve OPERATOR BIND INTENT from the dedicated surfaces ONLY: the --host flag, the
 *  daemon.host config key read from the FILE, or the dedicated OPENRIG_BIND_HOST env.
 *  A daemon.host value resolved from ENV is the overloaded routing channel
 *  (ENV_MAP maps daemon.host ← OPENRIG_HOST) and NEVER creates intent. */
export declare function resolveBindIntent(input: {
    flagHost: string | undefined;
    envBindHost: string | undefined;
    configSource: string;
    configHost: string;
}): {
    explicit: boolean;
    host: string | undefined;
};
/** The restored adoption/upgrade gate: derive the REQUIRED listener set from the
 *  daemon's reported effective bind mode (default ⇒ loopback AND
 *  tailscale-when-detected; explicit ⇒ exactly the declared host) and prove each by
 *  probing its own /healthz — binding evidence, never config echo. A silently dropped
 *  listener (the 0.5.3-receipt regression shape) fails LOUDLY. */
export declare function verifyRequiredListeners(input: {
    bind: {
        mode: "explicit" | "default";
        hosts: string[];
        tailscaleDetected: boolean;
    };
    port: number;
    /** TRI-STATE probe (r2 repair): "healthy" | "unhealthy" | "indeterminate".
     *  Refused/explicitly-unhealthy is POSITIVE bad-bind evidence; a transient probe
     *  exception is INDETERMINATE and never becomes missing-listener evidence. */
    probe: (url: string) => Promise<"healthy" | "unhealthy" | "indeterminate">;
}): Promise<{
    ok: true;
    verified: string[];
} | {
    ok: false;
    missing: string[];
    reason: string;
} | {
    ok: "indeterminate";
    reason: string;
}>;
export declare function startDaemon(opts: StartOptions, deps: LifecycleDeps): Promise<DaemonState>;
export declare function stopDaemon(deps: LifecycleDeps): Promise<"stopped" | "no-target">;
export declare function getDaemonStatus(deps: LifecycleDeps, options?: GetDaemonStatusOptions): Promise<DaemonStatus>;
export declare function readLogs(deps: LifecycleDeps): string | null;
export declare function tailLogs(deps: LifecycleDeps, opts: {
    follow: boolean;
}): void;
/**
 * 51-09 increment 3 — best-effort read of the daemon's boot-reconciled self-host
 * id from `/healthz`, for the CLI-direct send edge (the `From:` triple + the
 * reply-hint self-strip). ONE identity source (rider b): the same `/healthz`
 * field the daemon exposes, fetched on the SAME resolved local-daemon `url` the
 * send already uses — no second resolution path. Bounded by the existing
 * `HEALTHZ_PROBE_TIMEOUT_MS` (one timeout convention, not a new knob). C1
 * fail-open: returns `undefined` on ANY error / timeout / missing field — never
 * throws, never a hard daemon dependency, no new failure mode on the plain send
 * path (the envelope simply renders today's two-part form).
 */
export declare function fetchSelfHostId(deps: LifecycleDeps, url: string): Promise<string | undefined>;
/**
 * This host's own identity AND where it came from, for the surfaces that must make the state legible
 * before a cross-machine message fails. Same fail-open contract as `fetchSelfHostId`: unreachable
 * daemon yields undefined rather than a new failure mode.
 */
export declare function fetchSelfHostIdentity(deps: LifecycleDeps, url: string): Promise<{
    selfHostId: string;
    selfHostIdSource?: string;
} | undefined>;
/** Resolve this instance's persisted identity even during an outage; never read it from the target. */
export declare function resolveOriginSelfHostId(_deps: LifecycleDeps): Promise<string | undefined>;
export interface KernelReadyResult {
    ok: boolean;
    kernelState: string | null;
    variant: string | null;
    detail: string | null;
}
export declare function waitForKernelReady(baseUrl: string, timeoutMs: number, pollIntervalMs?: number): Promise<KernelReadyResult>;
//# sourceMappingURL=daemon-lifecycle.d.ts.map