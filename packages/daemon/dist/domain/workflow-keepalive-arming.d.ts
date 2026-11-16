import type { WatchdogJob, WatchdogJobsRepository } from "./watchdog-jobs-repository.js";
/**
 * Evaluation cadence for auto-armed keepalive jobs. Deadline-gated
 * evaluations are quiet skips until overdue, so this interval costs
 * nothing on the happy path (quiet skips are not even recorded in
 * watchdog history).
 */
export declare const WORKFLOW_KEEPALIVE_AUTO_INTERVAL_SECONDS: number;
export declare function buildKeepaliveSpecYaml(instanceId: string, targetSession: string, packetId?: string): string;
/**
 * Find the active auto/manual keepalive job carrying this instance id.
 * Jobs carry context only inside spec_yaml (no context column); ULIDs
 * are 26-char unique so a containment check is exact in practice.
 */
export declare function findArmedKeepaliveJob(repo: WatchdogJobsRepository, instanceId: string, packetId?: string): WatchdogJob | null;
/**
 * Idempotent in-transaction arm: registers the addressed packet keepalive
 * (or the legacy instance keepalive) if no active one exists. Composable inside the scribe txn
 * (register is a plain INSERT).
 */
export declare function ensureWorkflowKeepaliveArmed(repo: WatchdogJobsRepository, input: {
    instanceId: string;
    targetSession: string;
    registeredBySession: string;
    packetId?: string;
}): {
    jobId: string;
    newlyArmed: boolean;
};
/**
 * In-transaction disarm on terminal instance state (completed/failed):
 * the job goes terminal so no orphaned watchdog noise survives the
 * instance (FR-3 AC). No-op when nothing is armed.
 */
export declare function disarmWorkflowKeepalive(repo: WatchdogJobsRepository, instanceId: string, reason: string, packetId?: string): string | null;
export declare function disarmAllWorkflowKeepalives(repo: WatchdogJobsRepository, instanceId: string, reason: string): string[];
//# sourceMappingURL=workflow-keepalive-arming.d.ts.map