import type { TmuxAdapter } from "./tmux.js";
import type { SeatLaunchEnvironment } from "../domain/seat-launch-environment.js";
import type { RuntimeAdapter, NodeBinding, ResolvedStartupFile, InstalledResource, ProjectionResult, StartupDeliveryResult, ReadinessResult, HarnessLaunchResult } from "../domain/runtime-adapter.js";
import type { CodexProfileProbeResult } from "../domain/codex-profile-preflight.js";
import type { ProjectionPlan } from "../domain/projection-planner.js";
import { type AppliedLaunchObservation } from "../domain/permission-drift.js";
import { type ResolveHomeDirByPid } from "../domain/codex-thread-id.js";
import { type CodexDaemonSupportDetector } from "../domain/codex-daemon-support.js";
import { type CodexNetworkDefaultReader } from "../domain/codex-network-default.js";
import { type CodexGitAddDirResolver } from "../domain/codex-git-add-dirs.js";
import { type PrepareCodexTeamWorkspace } from "../domain/codex-team-workspace.js";
import { type NativeProcessRow } from "../domain/native-process-lineage.js";
type CodexProcess = NativeProcessRow;
/** What a running Codex was launched with that a launch would otherwise decide by probing (the network
 *  reader, the --no-daemon support probe) or by preparing directories (add-dirs). A relaunch that must keep the
 *  running Codex's effective settings takes these from its argv instead. */
export interface RunningCodexLaunch {
    networkOverride: boolean;
    daemonOptOut: boolean;
    addDirs: string[];
}
export interface CodexAdapterFsOps {
    readFile(path: string): string;
    writeFile(path: string, content: string): void;
    exists(path: string): boolean;
    mkdirp(path: string): void;
    listFiles?(dirPath: string): string[];
    /** Source file permission bits (for mode-preserving projection). Optional: mode preservation is a no-op if absent. */
    statMode?(path: string): number;
    /** Apply permission bits to a file (for mode-preserving projection). Optional: no-op if absent. */
    chmod?(path: string, mode: number): void;
    homedir?: string;
}
/**
 * Codex runtime adapter. Projects resources to .agents/ targets (preserving
 * existing Codex filesystem contract) and delivers startup files.
 */
export declare class CodexRuntimeAdapter implements RuntimeAdapter {
    readonly runtime = "codex";
    private tmux;
    private seatLaunchEnvironment?;
    private fs;
    private listProcesses;
    private readThreadIdByPid;
    private sleep;
    private resolveHomeDirByPid;
    private codexHome?;
    private launchPath?;
    private verifyProfilePreflight;
    private detectDaemonSupport?;
    private readNetworkDefault?;
    private resolveGitAddDirs;
    private prepareTeamWorkspace?;
    private resolveManagedConfigSettings?;
    private resolveHooksEnabled?;
    private activityRelayPath?;
    constructor(deps: {
        tmux: TmuxAdapter;
        seatLaunchEnvironment?: SeatLaunchEnvironment;
        fsOps: CodexAdapterFsOps;
        listProcesses?: () => CodexProcess[] | Promise<CodexProcess[]>;
        readThreadIdByPid?: (pid: number) => Promise<string | undefined> | string | undefined;
        resolveHomeDirByPid?: ResolveHomeDirByPid;
        sleep?: (ms: number) => Promise<void>;
        activityRelayPath?: string;
        /** Explicit CODEX_HOME; absent preserves the legacy OS/PID home behavior. */
        codexHome?: string;
        /** Match the daemon's prerequisite probe even if the pane's login shell rewrites PATH. */
        launchPath?: string;
        verifyProfilePreflight?: (profile: string) => Promise<CodexProfileProbeResult>;
        detectDaemonSupport?: CodexDaemonSupportDetector;
        readNetworkDefault?: CodexNetworkDefaultReader;
        resolveGitAddDirs?: CodexGitAddDirResolver;
        prepareTeamWorkspace?: PrepareCodexTeamWorkspace;
        /** Resolves the hooks setting and Codex version that ensureManagedConfig applies. Absent: no managed config write. */
        resolveManagedConfigSettings?: () => Promise<{
            enabled: boolean;
            codexVersion?: string;
        }>;
        /** Whether runtime.codex.hooks_enabled is on, without resolving the Codex version. Absent: nothing is stripped. */
        resolveHooksEnabled?: () => Promise<boolean>;
    });
    /**
     * Bring the Codex config.toml to the state OpenRig-managed seats need: feature flag,
     * activity hooks and their trust, or the stripped block when hooks are disabled. Runs when
     * a daemon has Codex seats (boot) or is about to launch one, never for a daemon without
     * them: a rig with no Codex seat leaves the user's config alone. A failure warns and does
     * not block the launch.
     */
    ensureManagedConfig(): Promise<void>;
    /**
     * Boot step for a daemon without Codex seats: when runtime.codex.hooks_enabled is false,
     * strip OpenRig's managed hooks block, as every boot did before. Removal writes only when
     * the block is present, so a config without it stays byte-identical, and with hooks enabled
     * nothing is touched. Without this an operator with no Codex seat has no OpenRig way to
     * remove a stale block. A failure warns.
     */
    stripManagedHooksIfDisabled(): Promise<void>;
    /**
     * plugin-primitive Phase 3a slice 3.5 — ensure Codex feature flag.
     *
     * When `enabled` is true, idempotently writes `codex_hooks = true` under
     * `[features]` in `~/.codex/config.toml`, creating the file if missing.
     * When `enabled` is false, makes ZERO modifications — the operator is
     * managing Codex config independently and the daemon does not touch it.
     *
     * Replaces the activity-hook-injection-coupled feature-flag set call
     * that lived inside the auto-injected activity-hook provisioning path
     * pre-rip (plugin-primitive Phase 3a slice 3.1).
     */
    ensureCodexFeatureFlag(enabled: boolean, opts?: {
        codexVersion?: string;
    }): void;
    /**
     * OPR.0.4.1.10 FR-A — write the OpenRig activity hooks into Codex's config layer
     * (`~/.codex/config.toml` inline `[hooks]`) so an OpenRig-launched Codex seat is
     * hook-PRIMARY from clean shipped config. Idempotent managed-block upsert for the
     * four events SessionStart / UserPromptSubmit / Stop / PermissionRequest; each
     * command is `node "<activityRelayPath>"` (the daemon's OWN shipped relay, FR-B —
     * cwd-independent, version-matched, NOT `${PLUGIN_ROOT}` nor a per-cwd copy). Also
     * pins `[features].hooks = true` (canonical key; the deprecated `codex_hooks` alias
     * is intentionally NOT used here). Trust is scoped to the exact authored hook
     * hashes below; remaining native review prompts require an operator decision.
     * The relay inherits the seat's OPENRIG_* env from the tmux session.
     *
     * Fail-safe: skips + warns when the relay asset is missing — never writes a hook that
     * points at a nonexistent script. Verified-firsthand (Codex 0.139, dev1-qa AC-2 proof):
     * on the OpenRig-managed launch path — managed inline hooks + trusted + the relay env
     * delivered into the seat (OPENRIG_URL + OPENRIG_ACTIVITY_HOOK_TOKEN + session/node/runtime)
     * — all four events, SessionStart included, deliver as runtime_hook activity. Without the
     * relay env the hooks are still trusted/visible but no activity rows land. (A bare/manual
     * codex TUI launch lacks that context and may not deliver SessionStart — not how OpenRig
     * launches seats.)
     */
    ensureCodexActivityHooks(): void;
    /**
     * OPR.0.4.3.33 — compute + splice Codex's `[hooks.state."<key>"] trusted_hash` for our 4
     * authored activity hooks into `content`. `key_source` is the canonicalized config path
     * (Codex keys trust by `std::fs::canonicalize(config.toml).display()`); we best-effort
     * `realpathSync` the config path to match — on a miss (file not yet on real disk, or a mock
     * fs in tests) we fall back to the plain absolute path, and any resulting key mismatch just
     * degrades to the launch-time trust gate (Layer-2 floor), never a broken run. The command
     * string is the value Codex deserializes from our TOML literal `'node "<relay>"'` — i.e.
     * `node "<relay>"` WITHOUT the outer TOML quote delimiters. Timeout=5, matcher/status None.
     */
    private applyCodexActivityHookTrust;
    /**
     * OPR.0.4.1.10 B3 — durable disable. When runtime.codex.hooks_enabled is false, strip the
     * OpenRig-managed activity-hooks sentinel block from ~/.codex/config.toml so a seat that was
     * previously provisioned with hooks does not keep firing them after the operator disables.
     * Removes ONLY the managed block — preserves any user-owned hooks and leaves [features].hooks
     * (the Codex 0.139 default) intact. Idempotent; no-op when the config or the block is absent.
     */
    removeCodexActivityHooks(): void;
    listInstalled(binding: NodeBinding): Promise<InstalledResource[]>;
    project(plan: ProjectionPlan, binding: NodeBinding): Promise<ProjectionResult>;
    deliverStartup(files: ResolvedStartupFile[], binding: NodeBinding): Promise<StartupDeliveryResult>;
    launchHarness(binding: NodeBinding, opts: {
        name: string;
        resumeToken?: string;
        forkSource?: import("../domain/runtime-adapter.js").ForkSource;
    }): Promise<HarnessLaunchResult>;
    /** The command launchHarness would type to resume `resumeToken`, wrapped in the seat launch environment,
     *  for a caller that runs it itself (a respawned direct-native pane). Nothing is sent to the pane. */
    buildResumeCommand(binding: NodeBinding, opts: {
        name: string;
        resumeToken: string;
        running?: RunningCodexLaunch;
    }): Promise<{
        ok: true;
        command: string;
        core: string;
        appliedLaunch: AppliedLaunchObservation;
    } | {
        ok: false;
        error: string;
    }>;
    /** Type a command buildResumeCommand built into the pane's shell, then verify the resume as launchHarness
     *  does. Nothing is prepared again, so the command runs exactly as it was built and checked. */
    sendResumeCommand(tmuxSession: string, command: string, resumeToken: string): Promise<HarnessLaunchResult>;
    /** launchHarness's resume verification for a resume the caller started itself: dismiss a skippable update
     *  prompt, then require a proven resumed conversation (never process-alive alone). */
    verifyResumeInPane(tmuxSession: string, resumeToken: string): Promise<HarnessLaunchResult>;
    /** Launch flags shared by fresh, fork and resume, decided once per launch. With `running`, the probed and
     *  prepared parts come from the running Codex instead, and no Codex process is started to decide them. */
    private prepareLaunch;
    private resumeCore;
    private seatCommand;
    private buildQueueStateAddDirArg;
    private captureProbeScreen;
    checkReady(binding: NodeBinding): Promise<ReadinessResult>;
    private dismissSkippableCodexUpdatePrompt;
    private observeMenuProcess;
    ensureManagedBootstrap(binding: {
        cwd?: string | null;
    }): void;
    private projectEntry;
    /**
     * Reapply the source file's permission bits to the projected dest. Plain
     * readFile+writeFile (writeFileSync) creates the dest with the process default
     * mode, dropping executable bits on nested plugin helpers (e.g. the
     * claude-compaction-restore/scripts/*.mjs 0755 hooks). No-op when the fs adapter
     * does not expose mode primitives (keeps existing mock-fs callers unaffected).
     */
    private preserveMode;
    private pluginAppliesToCodex;
    private resolveTargetDir;
    private applyRuntimeResource;
    /**
     * Merge a managed block into the target guidance file. Returns `true` when
     * the merge happened, `false` when intentionally skipped (rig-role). Callers
     * propagate the skip signal so ProjectionResult and StartupDeliveryResult
     * report honest counts.
     */
    private mergeGuidance;
    private detectDeliveryHint;
    private provisionWorkspaceTrust;
    private resolveCodexConfigPath;
    private readJsonObject;
    private readJsonObjectField;
    private workspaceTrustKeys;
    private captureFreshThreadId;
    private verifyResumeLaunch;
    private findCodexDescendantPids;
    private readThreadIdFromLogs;
    private launchCommand;
}
export interface CodexHookTrustInput {
    /** Codex hook_key source identity: canonicalized `~/.codex/config.toml` path. */
    keySource: string;
    /** The command as Codex DESERIALIZES it — `node "<relay>"` (no outer TOML quote delimiters). */
    command: string;
    /** Our authored hook timeout (seconds). */
    timeoutSec: number;
    /** None for our hooks; folded into the hash when present (kept for faithful reproduction). */
    matcher?: string | null;
    /** None for our hooks; folded into the hash when present. */
    statusMessage?: string | null;
    /** Positional group index within the event's matcher-group list (our hooks: 0). */
    groupIndex?: number;
    /** Positional handler index within the group's handler list (our hooks: 0). */
    handlerIndex?: number;
}
/**
 * Reproduce Codex's persisted hook trust `{ key, trusted_hash }` for one authored activity
 * hook. Pure + deterministic. See the block comment above for the full RTFM derivation and the
 * PROVISIONAL-until-VM-read-back caveat.
 */
export declare function computeCodexHookTrust(event: (typeof OPENRIG_ACTIVITY_HOOK_EVENTS)[number], input: CodexHookTrustInput): {
    key: string;
    hash: string;
};
/**
 * OPR.0.4.3.33 — idempotent, non-clobbering, section-scoped writer for a single
 * `[hooks.state."<key>"] trusted_hash = "<hash>"` record. Mirrors upsertCodexProjectTrust:
 * find/create the exact table header, splice ONLY its `trusted_hash` line, leave every other
 * `[hooks.state]` / `[projects]` entry and the managed hook block byte-identical. Same key+hash
 * ⇒ no-op. Only ever called for OUR 4 authored hook keys (never a blanket/wildcard trust).
 */
export declare function upsertCodexHookTrust(content: string, key: string, hash: string): string;
export declare function isCodex013xOrLater(version: string): boolean;
declare const OPENRIG_ACTIVITY_HOOK_EVENTS: readonly ["SessionStart", "UserPromptSubmit", "Stop", "PermissionRequest"];
export declare function defaultListProcesses(): Promise<CodexProcess[]>;
export {};
//# sourceMappingURL=codex-runtime-adapter.d.ts.map