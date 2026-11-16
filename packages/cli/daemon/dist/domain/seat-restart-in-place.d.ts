import type BetterSqlite3 from "better-sqlite3";
import { type TmuxAdapter } from "../adapters/tmux.js";
import type { ArbitratedSeatState } from "./activity-taxonomy.js";
import type { EventBus } from "./event-bus.js";
import type { SessionRegistry } from "./session-registry.js";
import type { HarnessLaunchResult, NodeBinding } from "./runtime-adapter.js";
import { type NativeProcessLister } from "./native-process-lineage.js";
import { type PaneCutoverTiming } from "./pane-cutover.js";
import type { RunningCodexLaunch } from "../adapters/codex-runtime-adapter.js";
/**
 * OPR.0.7.0.5 — restart ONE Codex seat in place so it reads its Codex home's current account: the same
 * conversation, resumed in the same pane, with the settings it is running with now, except reasoning effort,
 * which follows the seat's saved choice like every managed continuation (OPR.0.7.0.7). It never launches fresh,
 * forks, re-delivers startup context or retries; it never switches an account or reads token-bearing files.
 *
 * Reusable primitive: gates, the in-place resume for both pane shapes, and the per-seat report. Callers
 * (SeatLifecycleService) resolve the seat, hold its lifecycle lease and apply the shared refusals first.
 *
 * What it does NOT prove: that Codex saved its rollout before TERM/KILL, or that a stop part-way through
 * leaves history intact. Timing is not evidence of either; both are NOT VERIFIED until measured natively.
 */
export type InPlaceRestartTmux = Pick<TmuxAdapter, "getPanePid" | "getPaneCommand" | "listPanes" | "getSessionEnv" | "signalPid" | "setRemainOnExit" | "signalPaneProcess" | "isPaneDead" | "respawnPane" | "getPaneLocalOption" | "restorePaneOption" | "capturePaneHistory">;
/** The Codex runtime adapter's resume surface this operation reuses. */
export interface InPlaceCodexLauncher {
    buildResumeCommand(binding: NodeBinding, opts: {
        name: string;
        resumeToken: string;
        running?: RunningCodexLaunch;
    }): Promise<{
        ok: true;
        command: string;
        core: string;
    } | {
        ok: false;
        error: string;
    }>;
    verifyResumeInPane(tmuxSession: string, resumeToken: string): Promise<HarnessLaunchResult>;
    /** Types a built command into the pane's shell and verifies the resume, preparing nothing again. */
    sendResumeCommand(tmuxSession: string, command: string, resumeToken: string): Promise<HarnessLaunchResult>;
}
/** What one process shows about itself, read without touching any credential: cwd, executable, and only
 *  the named environment values below. Other environment values are never kept. */
export interface ProcessFacts {
    cwd: string | null;
    exe: string | null;
    env: {
        CODEX_HOME?: string;
        HOME?: string;
    };
    /** Names (never values) of API-key variables present. A name alone does not establish billing. */
    apiKeyEnvNames: string[];
}
export interface InPlaceRestartIo {
    readProcess(pid: number): Promise<ProcessFacts | null>;
    readThreadId(pid: number, startedAt: string, codexHome: string): Promise<string | undefined>;
    /** `cli_auth_credentials_store` from the home's config.toml: the value, null when unset, undefined when unreadable. */
    readCredentialStore(codexHome: string): string | null | undefined;
    /** stat (never read) of the home's auth.json. */
    statAuthFile(codexHome: string): {
        mtimeMs: number;
    } | null;
    findRollout(codexHome: string, conversationId: string): string | null;
    readRolloutTail(path: string): string | null;
}
export interface InPlaceRestartDeps {
    db: BetterSqlite3.Database;
    sessionRegistry: SessionRegistry;
    eventBus: EventBus;
    tmux: InPlaceRestartTmux;
    codex: InPlaceCodexLauncher;
    activity?: {
        getSeatState(nodeId: string): ArbitratedSeatState | null;
    } | null;
    listProcesses?: NativeProcessLister;
    io?: Partial<InPlaceRestartIo>;
    timing?: Partial<PaneCutoverTiming>;
    now?: () => Date;
    /** When this daemon process started. A started restart older than this can't still be running. */
    daemonStartedAt?: Date;
}
/** The seat as the caller resolved it, under its lifecycle lease. */
export interface InPlaceRestartTarget {
    seat: {
        rigId: string;
        rigName: string;
        logicalId: string;
        nodeId: string;
    };
    sessionId: string;
    sessionName: string;
    /** Saved choices for the seat's next managed launch. The restart keeps EFFECTIVE settings, except effort,
     *  which the binding carries from the shared resolver (seat-effort.ts). */
    saved: {
        model: string | null;
        effort: string | null;
        codexConfigProfile: string | null;
        /** Where the saved effort comes from. Only an explicit seat choice may change effort in place. */
        effortSource?: "seat_choice" | "authored" | "runtime_default";
    };
    binding: NodeBinding;
}
export type InPlaceRestartRefusalCode = "pane_unverified" | "pane_shape_unknown" | "resume_binding_unverified" | "settings_unverified" | "settings_drift" | "restart_in_progress" | "relaunch_unavailable" | "tmux_probe_failed";
export interface InPlaceRestartRefusal {
    ok: false;
    code: InPlaceRestartRefusalCode;
    message: string;
    guidance?: string;
    detail?: unknown;
}
export type InPlaceRestartOutcome = "restarted_account_unverified" | "not_started" | "incomplete" | "native_unknown";
type PaneShape = "shell_backed" | "direct_native";
export interface EffectiveSettings {
    model: string | null;
    profile: string | null;
    sandbox: string | null;
    approval: string | null;
    bypass: boolean;
    config: string[];
}
export interface InPlaceRestartReport {
    ok: true;
    planOnly: boolean;
    outcome?: InPlaceRestartOutcome;
    message: string;
    seat: InPlaceRestartTarget["seat"];
    sessionName: string;
    pane: string;
    paneShape: PaneShape;
    conversationId: string;
    conversationProof: "argv" | "native_logs";
    activity: {
        state: "working" | "needs_input" | "idle" | "unknown";
        needsInput: number | null;
        detail: string;
    };
    childProcesses: Array<{
        pid: number;
        name: string;
    }>;
    settings: {
        effective: EffectiveSettings;
        saved: InPlaceRestartTarget["saved"];
        note: string;
        /** OPR.0.7.0.7: the effort flag the running Codex was launched with, and the one the relaunch sends. */
        effort: {
            running: string | null;
            relaunch: string | null;
            changes: boolean;
            source: "seat_choice" | "authored" | "runtime_default";
        };
    };
    codexHome: string;
    billingRoute: {
        state: "unknown";
        detail: string;
        apiKeyEnvNames: string[];
    };
    account: AccountEvidence;
    peers: PeerReport[];
    oldProcess: {
        pid: number;
        startedAt: string | null;
    };
    newProcess?: {
        pid: number;
        startedAt: string | null;
        sameExecutable: boolean | null;
    };
    paneHeld?: {
        option: "remain-on-exit";
        value: "on";
        previous: string | null;
        detail: string;
    };
    /** After a failed direct-native stop or respawn: the pane and the original process, as observed. */
    observedAfterStop?: {
        pane: "present" | "gone" | "unknown";
        process: "running" | "exited" | "unknown";
        detail: string;
    };
    /** A restart of this seat that started under an earlier daemon run and never recorded a result. */
    staleRestart?: {
        startedAt: string;
        oldPid: number | null;
        pane: string | null;
        detail: string;
    };
    /** The seat's latest recorded in-place restart result, if any. */
    lastRestart?: {
        outcome: string;
        finishedAt: string;
    };
    remainingStep?: string;
    recoveryCommand?: string;
    couldNotSee?: string[];
    warnings: string[];
}
export interface AccountEvidence {
    verdict: "unverified";
    credentialStore: {
        value: string | null;
        state: "read" | "unset" | "unreadable";
        detail: string;
    };
    authFile: {
        changedBeforeRestart: boolean | null;
        detail: string;
    };
    startupGate: string | null;
    notVerified: string[];
}
export interface PeerReport {
    logicalId: string;
    sessionName: string | null;
    home: "same" | "different" | "unknown";
    effect: string;
}
export type InPlaceVerifyResult = {
    ok: true;
    seat: InPlaceRestartTarget["seat"];
    outcome: "moved" | "restarted_account_unverified";
    message: string;
    toolTurn: {
        completed: number;
        errors: number;
        since: string;
        state: "observed" | "not_observed" | "unreadable";
    };
    accountEvidence: {
        state: "matched" | "not_matched" | "not_requested" | "not_observed";
        detail: string;
    };
} | {
    ok: false;
    code: "no_restart_recorded" | "restart_not_completed" | "seat_restarted_since";
    message: string;
};
export declare class CodexInPlaceRestart {
    private readonly deps;
    private readonly io;
    private readonly timing;
    private readonly listProcesses;
    private readonly now;
    private readonly daemonStartedAt;
    constructor(deps: InPlaceRestartDeps);
    /** The newest started-event seq for a node; a request records it before waiting for the lifecycle lease. */
    latestStartedSeq(nodeId: string): number;
    /** Every gate, read-only. Returns the report a restart would start from, or the refusal it would give. */
    plan(target: InPlaceRestartTarget): Promise<InPlaceRestartReport | InPlaceRestartRefusal>;
    execute(target: InPlaceRestartTarget, input: {
        reason: string;
        operator: string | null;
        seenStartedSeq: number;
    }): Promise<InPlaceRestartReport | InPlaceRestartRefusal>;
    /** The restart after its started event. Updates `progress` so a throw is reported at its stage. */
    private restart;
    /**
     * `--verify`: after the operator has had the restarted seat complete a real tool-using turn (and, for
     * account evidence, shown Codex's /status), read what Codex recorded. `moved` needs BOTH a completed
     * tool call in this conversation since the restart, with no error event, AND an account line on the
     * pane that names the expected account. Nothing is typed into the seat.
     */
    verify(target: InPlaceRestartTarget, input: {
        expectAccount?: string | null;
    }): Promise<InPlaceVerifyResult>;
    private observe;
    /** Refuses while a restart of this seat is in flight under THIS daemon, or ran while the request waited.
     *  A started restart from before this daemon started can't still be running: it is reported, not refused. */
    private restartHistory;
    private observeCodex;
    /** Shell-backed: TERM the Codex chain's top process (not the pane's shell), KILL after the timeout, then
     *  require the original process gone AND the shell back in the foreground. */
    private stopUnderShell;
    private verifyReplacement;
    /** A direct-native stop or respawn that failed: report what the pane and the original process are now,
     *  as observed, never an assumed state. A pane that is gone holds nothing. */
    private afterFailedStop;
    private observeAfterStop;
    private incomplete;
    private activity;
    private accountEvidence;
    private peers;
    private readToolTurn;
    /**
     * Account evidence counts only when the line was produced after the restart. A cursor position can't show
     * that (a TUI rewrites rows above and below the cursor), so this compares occurrences: every Account line
     * in the pane's whole text when the restart finished was counted, and a line is new only when the same
     * text now occurs more often than it did then. Text that moved, stayed or was redrawn never counts more
     * than once; anything that can't be compared is not observed.
     */
    private readAccountLine;
    private persist;
}
/** The settings a Codex command line runs with. cwd, add-dirs, images and the resume target are not settings. */
export declare function parseEffectiveSettings(argv: string[]): EffectiveSettings;
/** Split a POSIX command line built with shellQuote (single quotes, double quotes, backslashes). */
export declare function shellWords(command: string): string[];
/** Whether a status `Account:` line names `expected` as a whole value: `bob@corp.com` doesn't match
 *  `jimbob@corp.com` or `bob@corp.com.au`. Case-insensitive, as account names are. */
export declare function accountLineNames(line: string, expected: string): boolean;
export declare function defaultInPlaceRestartIo(): InPlaceRestartIo;
export {};
//# sourceMappingURL=seat-restart-in-place.d.ts.map