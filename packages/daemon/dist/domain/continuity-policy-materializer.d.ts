import type { RegisterWatchdogJobInput, WatchdogJob } from "./watchdog-jobs-repository.js";
import { buildWidthRecoveryReceipt, type ContinuitySeatIdentity } from "./continuity-stack-packets.js";
export type CompactionStrategy = "default-compaction" | "managed-compaction" | "handover" | "apprentice-handover";
export declare const CONTINUITY_POLICY_DOC: string;
export interface ContinuityPolicyMaterializationInput {
    compactionStrategy: CompactionStrategy;
    runtime: string;
    targetSession: string;
    watchedFilePath: string | null;
    /** Explicit cutover executor. Required only by apprentice-handover. */
    mechanic?: string;
    tokensPerMegabyte?: number;
    registeredBySession?: string;
    seatIdentity?: Partial<ContinuitySeatIdentity>;
}
export interface ContinuityWatchdogPlan extends RegisterWatchdogJobInput {
    key: "prepare" | "cutover";
    requiresKey: "prepare" | null;
}
export interface ContinuityPolicyPlan {
    jobs: ContinuityWatchdogPlan[];
    docText: string;
}
type StoredContinuityJob = Pick<WatchdogJob, "jobId" | "state" | "specYaml" | "requiresJobId"> & Partial<Pick<WatchdogJob, "watchedFilePath" | "thresholdBytes" | "intervalSeconds" | "activeWakeIntervalSeconds" | "scanIntervalSeconds" | "registeredBySession" | "terminalReason" | "watchedFileGeneration" | "lastFiredGeneration">>;
export interface ContinuityJobsRegistrar {
    register(input: RegisterWatchdogJobInput): Pick<WatchdogJob, "jobId">;
    markTerminal?(jobId: string, reason: string): void;
    listExactTuple?(policy: string, targetSession: string, targetGenerationUuid: string | null): StoredContinuityJob[];
}
export interface ContinuityCutoverAction {
    type: "create-cutover-baton";
    jobId: string;
    occupantGeneration: string;
    sourceSession: string;
    destination: string;
    body: string;
}
export interface ContinuityQueueWriter {
    create(input: {
        qitemId: string;
        sourceSession: string;
        destinationSession: string;
        body: string;
        nudge?: boolean;
    }): Promise<{
        qitemId: string;
    }>;
}
export interface ContinuityHistoryWriter {
    record(input: {
        jobId: string;
        evaluatedAt: string;
        outcome: "skipped";
        skipReason: string;
        evaluationNotes: Record<string, unknown>;
    }): unknown;
}
export declare function materializeContinuityPolicy(input: ContinuityPolicyMaterializationInput): ContinuityPolicyPlan;
export declare function armContinuityPolicy(input: ContinuityPolicyMaterializationInput, registrar: ContinuityJobsRegistrar): Array<Pick<WatchdogJob, "jobId">>;
/** Existing QueueRepository.create is the only custody writer; the deterministic id makes retry identity. */
export declare function createContinuityCutoverBaton(action: ContinuityCutoverAction, queue: ContinuityQueueWriter): Promise<{
    qitemId: string;
}>;
/** Append a post-restore width receipt to the one managed prep job for this occupant. */
export declare function recordManagedWidthReceipt(input: {
    sessionName: string;
    occupantGeneration: string | null;
    postRestoreUsedPercentage: number;
    saturationBoundPercentage: number;
    evaluatedAt?: string;
}, jobs: ContinuityJobsRegistrar, history: ContinuityHistoryWriter): {
    jobId: string;
    receipt: ReturnType<typeof buildWidthRecoveryReceipt>;
} | null;
export declare function findClaudeTranscriptByToken(projectsRoot: string, token: string): string | null;
export declare class ContinuityPolicyMaterializer {
    private readonly jobsRepository;
    private readonly resolveWatchedFilePath;
    constructor(jobsRepository: ContinuityJobsRegistrar, resolveWatchedFilePath: (input: {
        sessionId: string;
        targetSession: string;
    }) => string | null);
    arm(input: Omit<ContinuityPolicyMaterializationInput, "watchedFilePath"> & {
        sessionId: string;
    }): Array<Pick<WatchdogJob, "jobId">>;
}
export {};
//# sourceMappingURL=continuity-policy-materializer.d.ts.map