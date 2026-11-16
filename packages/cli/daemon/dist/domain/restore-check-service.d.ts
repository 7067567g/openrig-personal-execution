import type { CurrentStateRehydrateEligibility } from "./rehydrate-eligibility.js";
import type { Snapshot, RigServicesRecord, SeatIdentityVerdict } from "./types.js";
export type CheckStatus = "green" | "yellow" | "red";
export type Verdict = "restorable" | "restorable_with_caveats" | "not_restorable" | "unknown";
export type ReadinessStatus = "ready" | "ready_with_caveats" | "not_ready" | "unknown";
export type HostInfraStatus = "not_inspected" | "not_declared" | "declared" | "unknown";
export interface CheckEntry {
    check: string;
    status: CheckStatus;
    evidence: string;
    remediation: string;
    /** Whether the remediation action is execution-safe (read-only / manual
     *  inspection). false for mutating actions (daemon start, chmod, create
     *  files, snapshot). Defaults to false (unsafe) if omitted — conservative
     *  so new checks without explicit classification don't invite agents to
     *  auto-execute mutating commands. */
    remediationSafe?: boolean;
}
export interface RepairStep {
    step: number;
    command: string;
    rationale: string;
    safe: boolean;
    blocking: boolean;
}
export interface ReadinessAssertion {
    status: ReadinessStatus;
    reason: string;
    blockingRigCount: number;
    caveatRigCount: number;
    unknownRigCount: number;
}
export interface ContinuityAssertion {
    status: "proven" | "not_proven" | "partial" | "not_applicable";
    evidence: string;
    provenCapabilities: string[];
    unprovenCapabilities: string[];
}
export interface ReadinessClassCounts {
    ready: number;
    ready_with_caveats: number;
    not_ready: number;
    attention_required: number;
    unknown: number;
}
export interface RigRestoreRollup {
    rigId: string;
    rigName: string;
    status: ReadinessStatus;
    verdict: Verdict;
    expectedNodes: number;
    runningReadyNodes: number;
    blockedNodes: number;
    caveatNodes: number;
    classCounts: ReadinessClassCounts;
    blockingChecks: CheckEntry[];
    caveatChecks: CheckEntry[];
}
export interface HostInfraAssertion {
    status: HostInfraStatus;
    evidence: string;
}
export type RecoveryStatus = "not_needed" | "actionable" | "blocked" | "unknown";
export interface RecoveryAction {
    scope: "rig";
    rigId: string;
    rigName: string;
    action: "restore_from_latest_snapshot";
    command: string;
    reason: string;
    safe: boolean;
    blocking: boolean;
}
export interface RecoveryIssue {
    scope: "host" | "rig";
    rigId?: string;
    rigName?: string;
    reason: string;
}
export interface RecoveryPlan {
    status: RecoveryStatus;
    summary: string;
    actions: RecoveryAction[];
    blocked: RecoveryIssue[];
    unknown: RecoveryIssue[];
}
export interface StartupContextResolvedFile {
    absolutePath: string;
    required: boolean;
    path?: string | null;
    deliveryHint?: string | null;
    ownerRoot?: string | null;
}
export interface StartupContextProjectionEntry {
    absolutePath: string;
    effectiveId?: string | null;
    category?: string | null;
    sourcePath?: string | null;
    resourceType?: string | null;
}
export interface QueueStoreProbeResult {
    available: boolean;
    evidence: string;
}
export type StartupContextProbeResult = {
    status: "ok";
    runtime: string | null;
    resolvedStartupFiles: StartupContextResolvedFile[];
    projectionEntries: StartupContextProjectionEntry[];
} | {
    status: "missing" | "malformed" | "probe_error";
    evidence: string;
};
export interface RestoreCheckResult {
    verdict: Verdict;
    readiness: ReadinessAssertion;
    continuity: ContinuityAssertion;
    rigs: RigRestoreRollup[];
    hostInfra: HostInfraAssertion;
    recovery: RecoveryPlan;
    counts: {
        red: number;
        yellow: number;
        green: number;
    };
    /** OPR.0.4.0.29 FR-8 — fleet-wide ready-confidence breakdown by class. */
    classCounts: ReadinessClassCounts;
    checks: CheckEntry[];
    repairPacket: RepairStep[] | null;
}
export interface RestoreCheckOpts {
    rig?: string;
    noQueue?: boolean;
    noHooks?: boolean;
    compact?: boolean;
    /** OPR.0.4.0.29 FR-2: in compact mode, still assemble ready-seat detail so
     *  `--ready` shows ready seats without dropping to the full firehose. */
    includeReady?: boolean;
    /** Composed status polls need preconditions only for rigs needing recovery. */
    recoveryOnly?: boolean;
}
export interface NodeInventoryEntry {
    nodeId?: string | null;
    rigId: string;
    rigName: string;
    logicalId: string;
    podId: string | null;
    podNamespace?: string | null;
    canonicalSessionName: string | null;
    nodeKind: "agent" | "infrastructure";
    runtime: string | null;
    sessionStatus: string | null;
    startupStatus: string | null;
    storedStartupStatus?: string | null;
    identityVerdict?: SeatIdentityVerdict | null;
    tmuxAttachCommand: string | null;
    latestError: string | null;
    cwd?: string | null;
}
export interface RestoreCheckDeps {
    /** Get all rigs as summaries */
    listRigs: () => Array<{
        rigId: string;
        name: string;
        hasServices?: boolean;
    }>;
    /** Get node inventory for a rig (ADR-0002: NodeInventory projection) */
    getNodeInventory: (rigId: string) => NodeInventoryEntry[];
    /** Get persisted startup context for a node */
    getStartupContext: (nodeId: string) => StartupContextProbeResult;
    /** Check if a snapshot exists for a rig */
    hasSnapshot: (rigId: string) => boolean;
    /** Get the newest snapshot for exact restore planning when available */
    getLatestSnapshot?: (rigId: string) => {
        id: string;
        kind: string;
    } | null;
    /** Exact ordinary-restore input; never captures an auto-rehydrate snapshot. */
    getRestoreInputs: (rigId: string) => {
        snapshot: Pick<Snapshot, "id" | "kind" | "data">;
        servicesRecord: RigServicesRecord | null;
    } | {
        currentStateRehydrate: CurrentStateRehydrateEligibility;
        reason: string;
    } | {
        unavailable: string;
    };
    /** Probe daemon health: returns { healthy: boolean; evidence: string } */
    probeDaemonHealth: () => {
        healthy: boolean;
        evidence: string;
    };
    /** Filesystem probes */
    exists: (path: string) => boolean;
    /** Read a declaration/config file. Kept injectable so restore-check remains testable and source-safe. */
    readFile: (path: string) => string;
    /** Shared-docs root for rig spec path resolution. */
    substrateRoot?: string;
    /** Read-only probe of the daemon SQLite queue store. */
    probeQueueStore?: () => QueueStoreProbeResult;
    /** Configured OpenRig instance root, matching the Claude adapter stateDir. */
    stateDir?: string;
    /** Relay-backed Claude hook events derived from the shipped hook manifest. */
    getClaudeActivityHookEvents?: () => string[];
}
export declare class RestoreCheckService {
    private deps;
    constructor(deps: RestoreCheckDeps);
    /**
     * Compute scoped restore checks and recovery guidance from daemon, rig and
     * seat evidence without launching occupants.
     */
    check(opts: RestoreCheckOpts): RestoreCheckResult;
    private checkRestorePreconditions;
    /** Returns CheckEntry on success/definite-down; null on probe exception
     *  (uninspectable state → caller should produce verdict: unknown). */
    private checkDaemonReachable;
    private checkStateDirWritable;
    private checkHostInfraDeclaration;
    private validateHostInfraDeclaration;
    private collectRequiredEvidencePaths;
    private resolveHostInfraEvidencePath;
    private checkSnapshot;
    private checkTranscript;
    private checkSeatReadiness;
    /**
     * Report available seat attachment or a read-only restore-plan command.
     * Missing attachment does not establish whether an earlier token can resume.
     */
    private checkResumePath;
    private checkStartupContext;
    private buildStartupContextAvailabilityCheck;
    private checkQueueStore;
    private checkHooks;
    private hasActivityRelayHook;
    private checkSpecPresent;
    private inspectLatestSnapshot;
    private buildResult;
    /** Probe error produces verdict=unknown (not not_restorable) so operators
     *  can distinguish "definitely broken" from "checker couldn't inspect." */
    private buildUnknown;
    private withAssertion;
    /** Derive proven capabilities from green checks for the continuity block. */
    private computeProvenCapabilities;
    private buildRecovery;
    private classifyRecoveryBlockingCheck;
    private buildRecoverySummary;
    private buildRigRollup;
    /** Generate ordered repair steps from non-green checks with remediation.
     *  null when all green (restorable — nothing to repair).
     *  Blockers (red) first in check order, then caveats (yellow). */
    private buildRepairPacket;
}
//# sourceMappingURL=restore-check-service.d.ts.map