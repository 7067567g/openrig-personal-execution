import type Database from "better-sqlite3";
import type { RigRepository } from "./rig-repository.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { ExecFn } from "../adapters/tmux.js";
import type { LegacyRigSpec as RigSpec, PreflightResult, RigSpec as PodRigSpec } from "./types.js";
interface RigSpecPreflightDeps {
    rigRepo: RigRepository;
    tmuxAdapter: TmuxAdapter;
    exec: ExecFn;
    cmuxExec: ExecFn;
}
export declare class RigSpecPreflight {
    readonly db: Database.Database;
    private rigRepo;
    private tmuxAdapter;
    private exec;
    private cmuxExec;
    constructor(deps: RigSpecPreflightDeps);
    check(spec: RigSpec): Promise<PreflightResult>;
}
import { type AgentResolverFsOps } from "./agent-resolver.js";
import { type ResolvedPolicyAttachment } from "./permission-policy/policy-ref.js";
export interface RigPreflightInput {
    rigSpecYaml: string;
    rigRoot: string;
    cwdOverride?: string;
    fsOps: AgentResolverFsOps;
    /** Config-resolved managed skill catalog root. Must match runtime resolution. */
    skillsRoot?: string;
    systemSkills?: string[];
    systemWorldError?: string;
    rigNameOverride?: string;
    externalQualifiedIds?: Iterable<string>;
    claudeActivityAssets?: {
        relayPath?: string;
        manifestPath?: string;
    };
    inheritedPermissionPolicy?: PreflightSpecContext["inheritedPermissionPolicy"];
}
/**
 * OPR.0.3.3.24: the non-YAML context the preflight CORE needs alongside an
 * already-parsed+validated spec. (YAML is only the input adapter at the front.)
 */
export interface PreflightSpecContext {
    rigRoot: string;
    cwdOverride?: string;
    fsOps: AgentResolverFsOps;
    /** Config-resolved managed skill catalog root. Must match runtime resolution. */
    skillsRoot?: string;
    systemSkills?: string[];
    systemWorldError?: string;
    rigNameOverride?: string;
    /** Effective persisted target-rig attachment for structured expansion.
     * Explicit member/fragment refs still win; this is the inherited fallback. */
    inheritedPermissionPolicy?: Pick<ResolvedPolicyAttachment, "ref" | "origin" | "resolvedTarget" | "declaringDir" | "launchPosture">;
    /** OPR.0.3.4.7 — exec for async probes (Codex profile-LOAD). When omitted,
     *  the Codex profile probe is skipped (backwards-compatible for callers that
     *  cannot provide exec, e.g. legacy sync-only test paths). */
    exec?: (cmd: string) => Promise<string>;
    /** Managed Claude activity-hook delivery asset paths (relay + canonical manifest). Defaults to
     *  the daemon-shipped assets (same as the ClaudeCodeAdapter); tests inject fixtures. Validated
     *  via the SHARED delivery check so preflight + adapter cannot drift. */
    claudeActivityAssets?: {
        relayPath?: string;
        manifestPath?: string;
    };
}
/**
 * Seam C: describe each seat's effective permission-policy attachment without
 * changing readiness or state. The existing Seam-B resolver remains the one
 * source of truth for member-over-rig precedence, origin, and launch posture.
 */
export declare function permissionPolicyDiscoveryWarnings(rigSpec: PodRigSpec, preflightCtx: Pick<PreflightSpecContext, "rigRoot" | "fsOps" | "inheritedPermissionPolicy">): string[];
/**
 * Rebooted rig preflight: validates rig spec, resolves all agent refs + profiles,
 * checks runtimes and cwd. Pure domain, no side effects beyond filesystem reads.
 * Returns the existing PreflightResult shape (ready + warnings[] + errors[]).
 * @param input - rig spec YAML, rig root, and filesystem ops
 * @returns PreflightResult
 */
export declare function rigPreflight(input: RigPreflightInput & {
    exec?: (cmd: string) => Promise<string>;
}): Promise<PreflightResult>;
/**
 * preflight CORE (OPR.0.3.3.24): every preflight check operates on the
 * normalized spec + non-YAML context (session-name components, agent_ref/profile
 * resolution, runtime, cwd). Extracted from rigPreflight with byte-identical
 * checks/order/error-strings so expand/add_member preflight a structured spec
 * with no YAML round-trip; rigPreflight(yaml) is the parse/normalize front over it.
 */
export declare function preflightValidatedSpec(rigSpec: PodRigSpec, preflightCtx: PreflightSpecContext): Promise<PreflightResult>;
/**
 * OPR.0.4.6.PI1 FR-1 — async post-preflight probe: when the spec declares any
 * `runtime: "pi"` member, verify the `pi` binary answers `pi --version`.
 * A daemon-side not-found is advisory: the pane may resolve Pi on its own PATH.
 * Version and probe failures are advisory, with bounded diagnostics.
 */
export declare function verifyPiRuntimeAvailable(rigSpec: PodRigSpec, exec: ExecFn, warnings?: string[]): Promise<string[]>;
/** Probe only OMP seats. An OMP spec must never depend on the Pi binary. */
export declare function verifyOmpRuntimeAvailable(rigSpec: PodRigSpec, exec: ExecFn): Promise<string[]>;
/**
 * OPR.0.3.4.7 — async post-preflight probe: verify Codex profile-v2 LOADS
 * for all Codex nodes with a non-empty codex_config_profile. Called AFTER
 * the synchronous preflight passes (codex --version already verified).
 * Returns errors to append to the preflight result; empty = all profiles load.
 */
export declare function verifyCodexProfiles(rigSpec: PodRigSpec, exec: (cmd: string) => Promise<string>): Promise<string[]>;
export {};
//# sourceMappingURL=rigspec-preflight.d.ts.map