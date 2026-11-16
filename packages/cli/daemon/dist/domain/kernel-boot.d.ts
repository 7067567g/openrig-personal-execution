import type { RigRepository } from "./rig-repository.js";
import type { BootstrapOrchestrator } from "./bootstrap-orchestrator.js";
import type { EventBus } from "./event-bus.js";
import type { SessionRegistry } from "./session-registry.js";
import { KernelBootTracker } from "./kernel-boot-tracker.js";
export type RuntimeAuthStatus = "ok" | "unavailable";
export interface RuntimeProbeResult {
    claudeCode: RuntimeAuthStatus;
    codex: RuntimeAuthStatus;
}
export interface KernelBootDeps {
    rigRepo: RigRepository;
    sessionRegistry: SessionRegistry;
    eventBus: EventBus;
    bootstrapOrchestrator: BootstrapOrchestrator;
    /** Absolute path to the daemon's specs dir (passed in so tests can
     *  inject a fixture root). Production callsite resolves to the
     *  packaged `packages/daemon/specs/` location. */
    specsDir: string;
    /** cwdOverride passed to BootstrapOrchestrator.bootstrap. Kernel
     *  members run against the operator's environment, not the daemon
     *  installation tree — without this override, the bootstrap path
     *  refuses with `cwd is inside the OpenRig installation`. Production
     *  callsite passes the resolved workspace.root setting; tests inject
     *  a fixture path. */
    cwdOverride: string;
    /** Runtime auth probe — defaults to live shellouts; tests inject. */
    probeRuntimes?: () => Promise<RuntimeProbeResult>;
    /** Logger sink; defaults to console.log/warn so daemon stdout/stderr
     *  carry the boot trace. */
    log?: (level: "info" | "warn" | "error", message: string) => void;
    /** Degraded-timer override (ms). Forward-fix #3 default 90s; tests
     *  pass short values to exercise the timer path quickly. */
    degradedTimeoutMs?: number;
}
/** Entry point. Idempotent: safe to call on every daemon startup.
 *  Returns the tracker immediately; bootstrap (if fired) runs in the
 *  background. Callers should NOT await the tracker's internal
 *  bootstrap promise — that's the whole point of the architectural
 *  decoupling. Tracker state is observable via getStatus() and the
 *  /api/kernel/status route. */
export declare function bootKernelIfNeeded(deps: KernelBootDeps): Promise<KernelBootTracker>;
/** The seats the selected kernel spec declares, as `pod.member` logical IDs, so a boot failure is treated as
 *  recovered only when every one of them is ready. null when the spec can't be read as pods with members: the
 *  tracker then keeps a failure current, because an unknown roster must never read as ready. */
export declare function expectedKernelSeats(specPath: string): string[] | null;
/** True when a rig named `kernel` already exists in the DB. */
export declare function kernelAlreadyManaged(rigRepo: RigRepository): boolean;
/** Choose a rig variant from the auth probe. */
export declare function selectVariant(probe: RuntimeProbeResult): string;
/** Default auth probe — shells out to the runtime CLIs. */
export declare function defaultProbeRuntimes(): Promise<RuntimeProbeResult>;
/** Issue #194 — how the Codex provider selected in `$CODEX_HOME/config.toml`
 *  authenticates. Only an explicit provider entry with
 *  `requires_openai_auth = false` and an `env_key` uses its credential
 *  variable. Everything else (no file, a parse error, a legacy top-level
 *  `profile`, a built-in or undeclared provider) keeps the OpenAI login check,
 *  so an unresolved config does not take the env-key shortcut; readiness still follows the login result. Other Codex config layers
 *  (project, system or managed config, requirements, `-c`, `--profile`) are not
 *  resolved here. The CLI's `rig setup` carries the same rule. */
export type CodexProviderAuth = {
    kind: "openai-login";
    unresolved?: string;
} | {
    kind: "env-key";
    providerId: string;
    envKey: string;
};
export declare function selectCodexProviderAuth(configToml: string | null): CodexProviderAuth;
/** Codex half of the kernel runtime probe. An env-key provider is ready when
 *  its variable is nonblank and the executable answers; this is local
 *  credential availability, not a remote authentication or inference check. */
export declare function probeCodexReadiness(deps: {
    run: (cmd: string) => Promise<RuntimeAuthStatus>;
    readConfig: () => string | null;
    env: Record<string, string | undefined>;
}): Promise<RuntimeAuthStatus>;
/** Honest 3-part-error message for the auth-block path. Per IMPL-PRD
 *  §6.3 + the building-agent-software skill discipline. */
export declare function authBlockMessage(): string;
//# sourceMappingURL=kernel-boot.d.ts.map