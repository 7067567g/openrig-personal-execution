import type { TmuxAdapter } from "./tmux.js";
import type { SeatLaunchEnvironment } from "../domain/seat-launch-environment.js";
import type { RuntimeAdapter, NodeBinding, ResolvedStartupFile, InstalledResource, ProjectionResult, StartupDeliveryResult, ReadinessResult, HarnessLaunchResult } from "../domain/runtime-adapter.js";
import type { ProjectionPlan } from "../domain/projection-planner.js";
import { type NativeProcessLister } from "../domain/native-process-lineage.js";
import type { ClaudeManagedLaunch } from "../domain/claude-managed-launch.js";
export interface ClaudeAdapterFsOps {
    readFile(path: string): string;
    writeFile(path: string, content: string): void;
    exists(path: string): boolean;
    mkdirp(path: string): void;
    copyFile(src: string, dest: string): void;
    listFiles?(dirPath: string): string[];
    /** Source file permission bits (for mode-preserving projection). Optional: mode preservation is a no-op if absent. */
    statMode?(path: string): number;
    /** Apply permission bits to a file (for mode-preserving projection). Optional: no-op if absent. */
    chmod?(path: string, mode: number): void;
    /** List files in a directory (for session token capture). */
    readdir?(dirPath: string): string[];
    /** User home directory (for session file lookup). */
    homedir?: string;
}
/**
 * Claude Code runtime adapter. Projects resources to .claude/ targets
 * and delivers startup files via guidance merge, skill install, or tmux send-text.
 */
export declare class ClaudeCodeAdapter implements RuntimeAdapter {
    readonly runtime = "claude-code";
    private tmux;
    private seatLaunchEnvironment?;
    private fs;
    private sessionIdFactory;
    private sleep;
    private stateDir;
    private collectorAssetPath;
    private autoDriveProviderPrompts;
    private listProcesses?;
    private readinessTimeoutMs?;
    private autoLaunches;
    readonly claudeManagedLaunch?: ClaudeManagedLaunch;
    private activityRelayPath;
    private claudeHooksManifestPath;
    /** P20 — called after a projected file is written to a target, so the manifest
     *  records what we last wrote (→ operator-vs-stale discrimination). No-op by default. */
    private recordProjection;
    constructor(deps: {
        tmux: TmuxAdapter;
        seatLaunchEnvironment?: SeatLaunchEnvironment;
        fsOps: ClaudeAdapterFsOps;
        sessionIdFactory?: () => string;
        sleep?: (ms: number) => Promise<void>;
        stateDir?: string;
        collectorAssetPath?: string;
        autoDriveProviderPrompts?: boolean;
        listProcesses?: NativeProcessLister;
        /** Bound on a slow resume's wait, from the launch (default: runtime.readiness_timeout_seconds). */
        readinessTimeoutMs?: number;
        claudeManagedLaunch?: ClaudeManagedLaunch;
        /** DI source of the activity-relay.cjs asset (parity with the Codex adapter). */
        activityRelayPath?: string;
        /** DI source of the canonical claude.json hooks manifest — the event vocabulary
         *  is derived (filtered to relay events) from it, not a parallel constant. */
        claudeHooksManifestPath?: string;
        /** P20 — record-at-apply hook (startup wires it to the projection manifest store).
         *  Absent → no-op (the manifest stays empty → discrimination safe-degrades to P17). */
        recordProjection?: (targetPath: string, content: string) => void;
    });
    listInstalled(binding: NodeBinding): Promise<InstalledResource[]>;
    project(plan: ProjectionPlan, binding: NodeBinding): Promise<ProjectionResult>;
    deliverStartup(files: ResolvedStartupFile[], binding: NodeBinding, sendInteractiveText?: (text: string) => Promise<void>): Promise<StartupDeliveryResult>;
    launchHarness(binding: NodeBinding, opts: {
        name: string;
        resumeToken?: string;
        forkSource?: import("../domain/runtime-adapter.js").ForkSource;
    }): Promise<HarnessLaunchResult>;
    checkReady(binding: NodeBinding): Promise<ReadinessResult>;
    /** Best-effort public seam for tmux-bound Claude sessions adopted outside the launch path. */
    ensureContextCollector(binding: {
        cwd?: string | null;
        tmuxSession?: string | null;
    }): void;
    /** Best-effort public seam for user-scope Claude bootstrap used by managed sessions. */
    ensureManagedBootstrap(binding: {
        nodeId?: string;
        cwd?: string | null;
        tmuxSession?: string | null;
        permissionMode?: NodeBinding["permissionMode"];
    }): void;
    private assessManagedProbe;
    /** tmux names a shell for every OpenRig launch (the launch script is `sh`), so its word alone can't say
     *  Claude is gone. With a bound pane, the process tree must show the pane's shell holding the terminal with
     *  nothing under it; Claude, or a launch script about to start it, is a slow resume. */
    private paneReturnedToShell;
    /** Who holds the pane, by the observations already there. "another": positively something other than this launch's own
     *  start: a ready screen whose lineage failed the check (with a process list that could be read), a Claude naming
     *  another conversation, or a stable Codex. Waiting won't make any of them this launch's, and its token is not recorded
     *  as an attempt. "own": this launch's Claude. "unknown": nothing seen yet (the launch script is starting it) or a
     *  process list that can't be read, whatever the screen shows. One process listing serves the Claude observations. */
    private paneOccupant;
    private verifyResumeLaunch;
    private projectEntry;
    /**
     * Reapply the source file's permission bits to the projected dest. Plain
     * readFile+writeFile (writeFileSync) creates the dest with the process default
     * mode, dropping executable bits on nested plugin helpers (e.g. the
     * claude-compaction-restore/scripts/*.mjs 0755 hooks). No-op when the fs adapter
     * does not expose mode primitives (keeps existing mock-fs callers unaffected).
     */
    private preserveMode;
    private pluginAppliesToClaude;
    private resolveTargetDir;
    /** true when applied, "skipped" when handled but not applied, false when this isn't a resource it handles. */
    private applyRuntimeResource;
    /** Merge a JSON fragment into a project file. An existing target that can't be read, or isn't a JSON object (it
     *  doesn't parse, or it holds an array or a single value), belongs to its owner: it's left as it is, nothing is
     *  merged, and a warning says so. Returns whether the fragment was applied. */
    private mergeJsonFragment;
    /**
     * Merge a managed block into the target guidance file. Returns `true` when
     * the merge happened, `false` when intentionally skipped (currently only the
     * `rig-role` case — see comment). Callers propagate the skip signal so
     * ProjectionResult and StartupDeliveryResult report honest counts instead
     * of claiming a merge that never landed.
     */
    private mergeGuidance;
    private detectDeliveryHint;
    private provisionManagedBootstrap;
    private provisionClaudeState;
    private workspaceTrustKeys;
    private readJsonObjectStrict;
    private readJsonObjectField;
    /**
     * Best-effort: provision the OpenRig context collector for managed Claude sessions.
     * Writes a collector script and merges status line config into .claude/settings.local.json.
     * Idempotent: safe to call multiple times (merge preserves existing settings). A user's own
     * status line command (anything but the exact command written below), or a file that does not
     * parse, is left as it is. The collector then never runs for that seat. While a valid sidecar
     * from an earlier collector is retained, context usage (shown as stale once it ages) and Claude
     * resume-token capture keep using it. That sidecar's session id may belong to an earlier Claude
     * session, so capture can record an older session id for such a seat. Once none exists:
     * - context usage reads unknown (`missing_sidecar`);
     * - resume-token capture at adoption or handover is skipped (`missing_sidecar`);
     * - its provider-usage row is an explicit unknown (`no_statusline_cache_yet`) unless an earlier
     *   cache for that seat is retained.
     * The read-modify-write below is not safe against a concurrent writer of the same file.
     */
    private provisionContextCollector;
    /**
     * Reconcile the OpenRig-managed activity-relay hooks in `.claude/settings.local.json`
     * to the desired `enabled` state, driven ONCE from the always-run `project()` seam.
     *
     * ENABLE (only when the relay SOURCE is readable): deliver `activity-relay.cjs` →
     * the configured instance state directory (mode preserved, 0755 from the source asset) and upsert
     * the owned command for each relay event DERIVED from the canonical claude.json manifest
     * (compaction hooks excluded). If the source is missing, deliver NOTHING (no dangling
     * commands) and report `sourceMissing` so the caller can surface a warning + not claim
     * projection. DISABLE: strip owned entries and prune emptied containers.
     *
     * Ownership is the EXACT `node <quoted relay path>` command shape, so a stale/changed
     * absolute prefix is replaced (never duplicated) while a user command that merely CONTAINS
     * the path is preserved. Fail-closed: a settings file we cannot parse is left byte-for-byte
     * untouched. Not `mergeJsonFragment` (additive union-by-key can't strip on disable).
     */
    private reconcileClaudeActivityHooks;
}
export interface ClaudeSelfReportRead {
    listFiles(dir: string): string[];
    readFile(path: string): string;
}
/** Read the freshest self-report for `sessionName` as ladder evidence, or null.
 *  Mapping: busy→working; idle→idle-at-prompt; shell→idle-at-prompt (turn over, a
 *  background shell lives — the omnigent-proven mapping); waiting→needs-input (a dialog
 *  owns input; Claude's internal `waiting` ≠ omnigent's — the collision both codebases
 *  warn about, kept OUT of the activity enum). */
export declare function readClaudeSelfReportEvidence(input: {
    sessionsDir: string;
    sessionName: string;
    seatNodeId: string;
    read?: ClaudeSelfReportRead;
}): import("../domain/activity-taxonomy.js").ActivityEvidence | null;
//# sourceMappingURL=claude-code-adapter.d.ts.map