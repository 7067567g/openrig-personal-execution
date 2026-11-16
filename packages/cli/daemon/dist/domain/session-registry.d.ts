import type Database from "better-sqlite3";
import type { Session, Binding } from "./types.js";
import type { ClaudeLaunchedProcess, ClaudeResumeRotation } from "./native-process-lineage.js";
export type OccupantKind = "initial" | "handover" | "adopt" | "fresh";
export interface OccupantTenure {
    id: string;
    nodeId: string;
    generationOrdinal: number;
    generationUuid: string;
    kind: OccupantKind;
    nativeSessionIdAtBoot: string | null;
    bootAt: string;
}
interface BindingFields {
    attachmentType?: "tmux" | "external_cli";
    tmuxSession?: string;
    tmuxWindow?: string;
    tmuxPane?: string;
    externalSessionName?: string;
    cmuxWorkspace?: string;
    cmuxSurface?: string;
}
/** The columns `claudeResumeRotation` reads. */
export declare const CLAUDE_RESUME_ROTATION_COLUMNS = "resume_token, resume_provenance, resume_rotated_from, resume_rotated_process, resume_launch_process";
/** The rotation a Claude identity proof may accept besides the stored token (#1077): the token
 *  OpenRig launched this row's process to resume, when the first hook after that launch, sent by
 *  that process, said Claude continued it as the stored token; and that process, the only one whose
 *  argv may name it. The hook's process must be the one the launch path itself observed starting on
 *  that token (`resume_launch_process`): a process that replaced it before its hook arrived is not.
 *  Null unless the stored token is still that hook's own record. Callers pass it as `rotation`. */
export declare function claudeResumeRotation(row: {
    resume_token?: string | null;
    resume_provenance?: string | null;
    resume_rotated_from?: string | null;
    resume_rotated_process?: string | null;
    resume_launch_process?: string | null;
} | null | undefined): ClaudeResumeRotation | null;
/** Resume-token provenance precedence (OPR.0.4.0.22; adoption rung added by
 *  OPR.0.4.3.20 FR-3). Higher rank wins; a lower-rank write never overwrites a
 *  higher-rank persisted token.
 *  operator/attested (deliberate set) > hook (runtime self-report) >
 *  adoption (captured at the reconcile/adopt/bind boundary) > scrape (pane).
 *  adoption sits BELOW hook deliberately: a live runtime hook self-report is
 *  fresher than an adoption-time snapshot, so hook must be able to refresh an
 *  adoption token (FR-3 §2.4 — do not freeze the token at adoption time and
 *  reintroduce the staleness the survive slice exists to kill). */
export declare const RESUME_PROVENANCE_RANK: Record<string, number>;
/** OPR.0.4.3.20 FR-4 — the latest live session per node, shape needed by the
 *  resume-metadata refresher (structurally compatible with ResumeRefreshSession). */
export interface LatestLiveSession {
    nodeId: string;
    sessionId: string;
    sessionName: string;
    status: string;
    runtime: string | null;
    resumeType: string | null;
    resumeToken: string | null;
    cwd: string | null;
}
export interface WatchdogRegistrationObserver {
    ensure(nodeId: string, sessionName: string): unknown;
    assertCoverage(nodeId: string, sessionName: string): unknown;
    isEligibleSessionName?(sessionName: string): boolean;
    reconcileHandover?(nodeId: string, sessionName: string): unknown;
}
export declare class SessionRegistry {
    readonly db: Database.Database;
    private watchdogRegistrationObserver?;
    constructor(db: Database.Database, watchdogRegistrationObserver?: WatchdogRegistrationObserver);
    setWatchdogRegistrationObserver(observer: WatchdogRegistrationObserver): void;
    registerSession(nodeId: string, sessionName: string, kind?: OccupantKind, reservedGeneration?: string | null): Session;
    /** Register a claimed session — skips naming validation, sets origin='claimed', startup_status='ready'. */
    registerClaimedSession(nodeId: string, sessionName: string, kind?: OccupantKind, reservedGeneration?: string | null): Session;
    /**
     * atom-B — mint (or CONTINUE) the occupant-generation tenure for a node. RELAUNCH is a CONTINUATION:
     * if the same native session id is already recorded for this node, return the existing tenure WITHOUT
     * minting a new generation. A new occupant (initial/handover/adopt, or a new/unknown native session)
     * mints the next generation_ordinal with a fresh generation_uuid. Append-only — the ledger is never
     * mutated. (Relaunch also naturally continues by NOT re-calling the register verbs; the native-session
     * dedup here is the safety net for a re-register.)
     */
    /** atom-B — mint the occupant tenure at a register verb, but FAIL-ISOLATED: a session registration
     *  (a core operation) must NOT die because the additive occupant-generation ledger write failed
     *  (e.g. a db that has not run migration 060). On failure we LOG loudly (once per process — a
     *  missing ledger table in production is a visible defect) and let the register succeed;
     *  generation-scoped consumers degrade to loud-pending, never a silent-wrong. Direct callers that
     *  REQUIRE the tenure use `mintOccupantTenure` (which throws). */
    private mintOccupantTenureBestEffort;
    private static tenureMintWarned;
    private observeWatchdogRegistration;
    private runWatchdogEnsure;
    private static watchdogEnsureWarned;
    /** Reserve the generation that a managed process will carry before it starts. The capability probe
     * is read-only: a failed/missing ledger yields null and launch continues without fabricating state. */
    reserveOccupantGeneration(): string | null;
    /** True only when this exact generation is registered for this exact node. Throws on ledger faults so
     * callers can preserve the distinct generation_resolver_error verdict. */
    isOccupantGenerationRegistered(nodeId: string, generationUuid: string): boolean;
    mintOccupantTenure(nodeId: string, kind: OccupantKind, nativeSessionIdAtBoot?: string | null, reservedGeneration?: string | null): OccupantTenure;
    /** The LIVE (latest) occupant generation for a node, or null. Consumers compare an entry's minting
     *  generation_uuid to this to gate stale-generation state (the ghost-stage defect). */
    currentOccupantTenure(nodeId: string): OccupantTenure | null;
    /** ghost-stage (b): the LIVE occupant generation_uuid for the node currently backing a session
     *  NAME, or null when UNKNOWN (no session row / no node / no tenure — consumers treat null as
     *  UNKNOWN, never as a match against a stale generation). This is the resolver the compaction
     *  enforcer's gen-scoped stage gate consumes. Never throws (a bad lookup returns null). */
    currentOccupantGenerationForSession(sessionName: string): string | null;
    private rowToTenure;
    updateStatus(sessionId: string, status: string): void;
    /** A supported stop is distinct from an observed exit. Any later status write
     * clears the intent, including a resume of this same session row. */
    markIntentionallyStopped(sessionId: string): void;
    updateStartupStatus(sessionId: string, status: "pending" | "ready" | "attention_required" | "failed", completedAt?: string): void;
    /** Record that this session was launched for a community agent app, selected through its preset. */
    recordAgentAppSelection(sessionId: string, app: string): void;
    updateResumeToken(sessionId: string, type: string, token: string, provenance?: "hook" | "scrape" | "operator" | "adoption"): boolean;
    /** Record a Claude SessionStart hook's session id, with the evidence of how it began (#1077).
     *
     * The write itself follows `updateResumeToken`'s hook rank. The first hook carrying the node's
     * current occupant generation after OpenRig launched this row with `--resume <T1>` consumes that
     * launch, whatever its source: only that hook can name T1 as the token it replaced, and only when
     * it reports `source: "resume"`, a different id, and the launch marker OpenRig put on that
     * process's command (`OPENRIG_RESUME_LAUNCH=T1`), which a Claude started by hand in the pane does
     * not carry, and when the caller observed that the hook came from the launched process itself
     * (`claudeHookFromLaunchedProcess`): a child `claude -p --resume` inherits the marker but is a
     * different process. The rotation keeps that process (pid and start time), and only it may later
     * name T1. Any later hook (an in-process `/resume`, a child `claude -p --resume` sharing the
     * seat's environment, a replacement process) has no launch to name, which leaves today's refusal
     * in place. */
    recordHookSessionIdentity(sessionId: string, type: string, token: string, evidence: {
        source: string | null;
        currentGeneration: boolean;
        resumeLaunch?: string | null;
        launchedProcess?: ClaudeLaunchedProcess | null;
    }): boolean;
    /** The resume launch armed for this row and not yet consumed by a hook, if any. */
    armedResumeLaunch(sessionId: string): string | null;
    /** Arm the launch about to resume `token` in this row's Claude process (null for a fresh launch).
     *  Recorded before the launch, since the SessionStart hook can land before the launch returns. It
     *  certifies nothing: it only lets the first hook after this launch name the token it replaced. */
    recordResumeLaunch(sessionId: string, token: string | null): void;
    /** The process the launch path observed starting on `token`, right after that launch succeeded
     *  (`observeClaudeResumeLaunch`). Only a rotation whose hook came from this process counts. */
    recordResumeLaunchProcess(sessionId: string, token: string, process: ClaudeLaunchedProcess): void;
    /** True when this row's hook-recorded resume rotation started from `token`. */
    claudeResumeRotatedFrom(sessionId: string, token: string): boolean;
    /** A forked occupant (nodes.continuity_outcome = 'forked') whose own id is still pending must never
     *  record an id another session row already holds: in a fork's process that is its parent's
     *  (or a predecessor's) conversation, not its own. */
    isForkClaimingHeldToken(sessionId: string, type: string, token: string): boolean;
    /** Test durable identity without returning the stored credential or changing
     *  its provenance. An equal protected token needs no lower-ranked write. */
    resumeTokenMatches(sessionId: string, type: string, token: string): boolean;
    /** Preserve a resume target that was attempted but not verified.
     *
     * Attention outcomes include live chooser prompts, runner exits, and
     * readiness timeouts, so reaching one cannot certify the token as resumable.
     * Only fill an empty session row: a concurrent hook/operator write is
     * stronger evidence and must win. */
    recordResumeAttempt(sessionId: string, type: string, token: string): boolean;
    /** OPR.0.4.3.20 FR-6 — record a live resume-probe outcome WITHOUT clearing the
     *  token. On `resumable` it stamps the freshness marker (equal-value-refresh);
     *  on `not_resumable` / `inconclusive` it marks the PRESENT token stale so the
     *  restore plan surfaces it as `stale/unverified — re-verify` (never a silent
     *  null). This replaces the old clear-on-not-resumable behavior (§2.1b) — the
     *  token stays put; FR-7's blank/fresh rollback catches an actually-unresumable
     *  token at restore time. */
    markResumeProbeResult(sessionId: string, status: "resumable" | "not_resumable" | "inconclusive"): void;
    /** OPR.0.4.0.22 — resolve a canonical session name to the context needed to
     *  set its resume token: the latest session row + its node's runtime + the
     *  current resume provenance. Match inventory's ID ordering: the monotonic
     *  factory preserves registration order through clock rollback in this daemon.
     *  Returns null when no session matches. */
    findResumeContextByName(sessionName: string): {
        sessionId: string;
        nodeId: string;
        rigId: string;
        runtime: string | null;
        currentProvenance: string | null;
    } | null;
    clearResumeToken(sessionId: string): void;
    markDetached(sessionId: string): void;
    markSuperseded(sessionId: string): void;
    clearBinding(nodeId: string): void;
    getSessionsForRig(rigId: string): Session[];
    /**
     * OPR.0.7.0 P1b — live seats for a set of runtimes and one model, used by the
     * provider/model start limiter. Live statuses match the resume/teardown
     * definition (`running` / `idle` / `unknown`). An empty runtime set is 0, and
     * an empty model matches `nodes.model IS NULL` (the "no explicit model" key).
     */
    countLiveSeatsByRuntimesAndModel(runtimes: readonly string[], model: string | null): number;
    /** OPR.0.4.3.20 FR-4 — the latest session PER NODE, filtered to live statuses
     *  (running / idle / unknown), with the fields the resume-metadata refresher
     *  needs. Lifted from rig-teardown so both the teardown pre-down path and the
     *  FR-4 periodic/manual snapshot refresh call ONE query (no duplication). */
    getLatestLiveSessions(rigId: string): LatestLiveSession[];
    getBindingForNode(nodeId: string): Binding | null;
    updateBinding(nodeId: string, fields: BindingFields): Binding;
    private rowToSession;
    private rowToBinding;
}
/** The SQL that reads a session's recorded agent app: `<alias>.agent_app`, or NULL on a schema without that column
 *  (as other optional columns are read), so a partial schema reads every seat as before. The schema check is made
 *  once per database: the column only appears through a migration, which runs before these reads. */
export declare function sessionAgentAppSelect(db: Database.Database, alias?: string): string;
export {};
//# sourceMappingURL=session-registry.d.ts.map