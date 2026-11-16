import type { SessionRegistry } from "./session-registry.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import { type ResolveHomeDirByPid, type CodexCaptureReporter } from "./codex-thread-id.js";
import { type ResumeTokenCaptureDeps } from "./resume-token-capture.js";
import { type NativeProcessLister } from "./native-process-lineage.js";
export interface ResumeRefreshSession {
    sessionId: string;
    sessionName: string;
    runtime: string | null;
    resumeType: string | null;
    resumeToken: string | null;
    cwd?: string | null;
}
interface ResumeMetadataRefresherDeps {
    sessionRegistry: SessionRegistry;
    tmuxAdapter: TmuxAdapter;
    listProcesses?: () => Array<{
        pid: number;
        ppid: number;
        command: string;
    }> | Promise<Array<{
        pid: number;
        ppid: number;
        command: string;
    }>>;
    readCodexThreadIdByPid?: (pid: number, identity?: string, report?: CodexCaptureReporter) => Promise<string | undefined> | string | undefined;
    probeClaudeResume?: (sessionName: string, resumeToken: string, cwd?: string | null) => Promise<"resumable" | "not_resumable" | "inconclusive">;
    resolveHomeDirByPid?: ResolveHomeDirByPid;
    sleep?: (ms: number) => Promise<void>;
    homeDir?: string;
    codexHome?: string;
    log?: (line: string) => void;
    contextUsageStore?: {
        readSidecar(sessionName: string): {
            ok: true;
            data: {
                session_id?: string;
                sampled_at?: string;
            };
        } | {
            ok: false;
            reason: string;
        };
    };
    /** #421 — start time of the pane's current Claude process; a sidecar sampled earlier is not used. */
    claudeProcessStartedAt?: ResumeTokenCaptureDeps["claudeProcessStartedAt"];
    /** Provider root used by the daemon's Claude launches; no scan of other homes. */
    claudeConfigDir?: string;
    listClaudeProcesses?: NativeProcessLister;
    /** CLI-agent runner sidecars; both expose readSessionFile(sessionName). */
    opencodeRunnerStateStore?: ResumeTokenCaptureDeps["opencodeRunnerStateStore"];
    dshRunnerStateStore?: ResumeTokenCaptureDeps["dshRunnerStateStore"];
}
export declare class ResumeMetadataRefresher {
    private readonly stopped;
    private readonly captures;
    private readonly log;
    private sessionRegistry;
    private tmuxAdapter;
    private listProcesses;
    private readCodexThreadIdByPid;
    private probeClaudeResume;
    private resolveHomeDirByPid;
    private sleep;
    private homeDir;
    private contextUsageStore;
    private claudeProcessStartedAt;
    private claudeConfigDir;
    private listClaudeProcesses;
    private opencodeRunnerStateStore;
    private dshRunnerStateStore;
    constructor(deps: ResumeMetadataRefresherDeps);
    /**
     * Refresh the live per-seat resume ledger.
     *
     * OPR.0.4.3.20 FR-4 (rev1 fix) — `opts.fillNullOnly` is the **snapshot-refresh**
     * mode used by the RECURRING snapshot paths (periodic scheduler every ~5min +
     * manual route). It does exactly two things, both LIGHTWEIGHT (file reads only,
     * like FR-3's capture — Claude sidecar `readSidecar` + Codex `captureCodexThreadId`
     * over pid-logs), and NOTHING heavy:
     *   1. FILL-NULL ONLY — populate a null token from live state; NEVER clear an
     *      already-present token (rev1-r2). A present-but-not-currently-resumable
     *      Claude token SURVIVES the routine snapshot (stays in the ledger for FR-6 to
     *      surface as `stale/unverified — re-verify`) instead of being nulled before
     *      FR-6 exists. Invariant: **a snapshot refresh never clears a present token.**
     *   2. NO heavyweight resumability PROBE — it never runs `probeClaudeResume`
     *      (which spawns a real `claude --resume` tmux session per present Claude seat).
     *      Spawning N probe processes every periodic tick, forever, against live seats
     *      is unacceptable recurring blast radius (rev1-r1). Resumability VERIFICATION
     *      is FR-6's on-demand job, not a recurring-snapshot op.
     *
     * At shutdown (`fillNullOnly` falsy), first read Claude's live PID-keyed session
     * file: /clear changes its sessionId without changing the launch argv, and the
     * old conversation can still be resumable. If unavailable, retain the existing
     * probe behavior. Never clear a token or add a shutdown refusal.
     */
    refresh(sessions: ResumeRefreshSession[], opts?: {
        fillNullOnly?: boolean;
        /** OPR.0.5.3.10 mini-req 2 — a CYCLE-SCOPED process lister (one census for
         *  the whole tick, all rigs and seats). Absent → the instance lister. */
        listProcesses?: () => Promise<Array<{
            pid: number;
            ppid: number;
            command: string;
        }>>;
    }): Promise<void>;
    /** Shutdown-only read, bounded to the stable foreground Claude process's own
     * file. A same-name file or launch argument cannot identify the post-/clear
     * conversation. Missing/ambiguous observations retain the legacy fallback. */
    private captureClaudeSessionId;
    /** Stop in-flight discovery before shutdown closes HTTP or the database. No wait on native probes. */
    stop(): void;
    private captureState;
    /** Best-effort derive a Codex thread id from live pane state (getPanePid →
     *  codex descendant pids → pid-keyed logs sqlite). Async, returns undefined
     *  on timeout/absence. Public for reuse by adoption-boundary capture
     *  (OPR.0.4.3.20 FR-3) — no behavior change to the teardown-path scrape. */
    captureCodexThreadId(sessionTarget: string, opts?: {
        attempts?: number;
        sessionId?: string;
        listProcesses?: () => Promise<Array<{
            pid: number;
            ppid: number;
            command: string;
        }>>;
    }): Promise<string | undefined>;
    private defaultProbeClaudeResume;
    private waitForProbeShellReady;
}
export declare function defaultListProcesses(): Promise<Array<{
    pid: number;
    ppid: number;
    command: string;
}>>;
/** OPR.0.5.3.10 r2-B2 — the STRICT production lister: a failed `ps` spawn
 *  REJECTS instead of degrading to []. This is the census's default —
 *  through the lenient variant above, an enumeration failure became a CACHED
 *  empty SUCCESS for the whole freshness window (r2's discriminator: 0 rows
 *  cached while 520 were live). The lenient variant keeps its contract for
 *  the direct per-call consumers that want best-effort. */
export declare function defaultListProcessesStrict(): Promise<Array<{
    pid: number;
    ppid: number;
    command: string;
    startedAt: string;
}>>;
export {};
//# sourceMappingURL=resume-metadata-refresher.d.ts.map