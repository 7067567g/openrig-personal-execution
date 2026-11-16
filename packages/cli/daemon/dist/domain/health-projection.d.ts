import type { QueueTransition } from "./queue-transition-log.js";
import type { WatchdogHistoryEntry } from "./watchdog-history-log.js";
import type { ContextUsage, NodeInventoryEntry } from "./types.js";
import type { OperatingPosture } from "./rig-mode/operating-posture.js";
export declare const HEALTH_RECORD_SCHEMA: "openrig.health/v0alpha1";
export declare const HEALTH_CATEGORIES: readonly ["behavioral", "process", "governance", "epistemic", "context"];
export declare const HEALTH_SEVERITIES: readonly ["info", "warning", "critical"];
export declare const HEALTH_CONFIDENCE: readonly ["high", "medium"];
export declare const HEALTH_STATUSES: readonly ["active", "cleared", "indeterminate"];
export type HealthCategory = (typeof HEALTH_CATEGORIES)[number];
export type HealthSeverity = (typeof HEALTH_SEVERITIES)[number];
export type HealthConfidence = (typeof HEALTH_CONFIDENCE)[number];
export type HealthStatus = (typeof HEALTH_STATUSES)[number];
export type HealthScope = {
    type: "instance";
    instanceId: string;
} | {
    type: "rig";
    rigId: string;
} | {
    type: "seat";
    rigId: string;
    seatId: string;
} | {
    type: "mission";
    projectId: string;
    missionId: string;
} | {
    type: "slice";
    projectId: string;
    missionId: string;
    sliceId: string;
};
interface EvidenceBase {
    sourceOrder: number;
    observedAt: string | null;
}
export type HealthEvidenceReference = (EvidenceBase & {
    type: "queue-transition";
    qitemId: string;
    transitionId: number;
    state: string;
    actorSession: string;
    identityProvenance: string | null;
}) | (EvidenceBase & {
    type: "watchdog-history";
    jobId: string;
    historyId: string;
    outcome: string;
    deliveryStatus: string | null;
}) | (EvidenceBase & {
    type: "work-graph";
    nodeType: "mission" | "slice";
    nodeId: string;
    missionId: string;
    stage: string | null;
    dependsOn: string[];
}) | (EvidenceBase & {
    type: "topology-activity";
    nodeId: string;
    sessionName: string | null;
    activity: string | null;
    activitySequence: number | null;
}) | (EvidenceBase & {
    type: "context-usage";
    nodeId: string;
    sessionId: string | null;
    usedPercentage: number | null;
    available: boolean;
    fresh: boolean;
}) | (EvidenceBase & {
    type: "occupant-model";
    nodeId: string;
    occupantGeneration: string | null;
    runtime: string | null;
    model: string | null;
}) | (EvidenceBase & {
    type: "lifecycle-receipt";
    receiptId: string;
    operation: string;
    outcome: string;
});
export interface HealthQueryBounds {
    source: HealthEvidenceReference["type"] | "mixed";
    startedAt: string;
    endedAt: string;
    limit: number;
    retentionSeconds: number;
}
export type HealthFreshnessState = "fresh" | "stale" | "unavailable" | "contradictory";
export interface HealthSourceFreshness {
    state: HealthFreshnessState;
    evaluatedAt: string;
    newestSourceAt: string | null;
    maxAgeSeconds: number;
    ageSeconds: number | null;
}
export interface BoundedHealthEvidence {
    query: HealthQueryBounds;
    freshness: HealthSourceFreshness;
    evidence: HealthEvidenceReference[];
    omitted: {
        outOfWindow: number;
        missingTimestamp: number;
        sourceMismatch: number;
        truncated: number;
        retentionClipped: boolean;
    };
}
/** Passive traffic is a question for an agent, not a ratio or a diagnosis. */
export interface CeremonyProgressAssessment {
    basis: string;
    conclusion: "established" | "false-positive" | "indeterminate";
    outcomes: Array<{
        id: string;
        observedAt: string;
        evidenceRefs: string[];
    }>;
    boundedAuthority: boolean | null;
    boundary: string;
    evidenceRefs: string[];
    missingFacts: string[];
}
export interface PassiveCeremony {
    origin: "passive";
    stage: "needs-diagnosis" | "confirmed" | "cleared" | "indeterminate";
    lineageId: string;
    basis: string;
    transitionIds: number[];
    context: Array<{
        path: string;
        state: "available" | "unavailable";
        sha256?: string;
        role: string;
    }>;
    workflowReceipts: Array<{
        trailId: string;
        instanceId: string;
        stepId: string;
        qitemId: string;
        closureReason: string;
        actor: string;
        at: string;
        evidence: unknown;
    }>;
    assessment?: {
        result: CeremonyProgressAssessment;
        actor: string;
        at: string;
        transitionId: number;
        identityProvenance: string | null;
    };
    missingFacts: string[];
}
export interface HealthRecordDraft {
    episodeKey?: string;
    ceremony?: PassiveCeremony;
    detector: string;
    category: HealthCategory;
    scope: HealthScope;
    severity: HealthSeverity;
    confidence: HealthConfidence;
    status: HealthStatus;
    startedAt: string | null;
    lastObservedAt: string | null;
    summary: string;
    threshold: string;
    explanation: string;
    suggestedInspection: string;
    source: BoundedHealthEvidence;
}
export interface HealthRecord {
    operatingPosture?: OperatingPosture;
    ceremony?: PassiveCeremony;
    policyVersion?: string;
    schema: typeof HEALTH_RECORD_SCHEMA;
    id: string;
    detector: string;
    category: HealthCategory;
    scope: HealthScope;
    severity: HealthSeverity;
    confidence: HealthConfidence;
    status: HealthStatus;
    startedAt: string | null;
    lastObservedAt: string | null;
    window: HealthQueryBounds;
    freshness: HealthSourceFreshness;
    summary: string;
    evidence: HealthEvidenceReference[];
    threshold: string;
    explanation: string;
    suggestedInspection: string;
    indeterminateReason: string | null;
}
export declare function adaptQueueTransitionEvidence(transition: Pick<QueueTransition, "transitionId" | "qitemId" | "ts" | "state" | "actorSession" | "identityProvenance">, sourceOrder: number): HealthEvidenceReference;
export declare function adaptWatchdogHistoryEvidence(entry: Pick<WatchdogHistoryEntry, "jobId" | "historyId" | "evaluatedAt" | "outcome" | "deliveryStatus">, sourceOrder: number): HealthEvidenceReference;
export declare function adaptWorkGraphEvidence(input: {
    sourceOrder: number;
    observedAt: string;
    nodeType: "mission" | "slice";
    nodeId: string;
    missionId: string;
    stage: string | null;
    dependsOn?: readonly string[];
}): HealthEvidenceReference;
export declare function adaptTopologyActivityEvidence(node: Pick<NodeInventoryEntry, "logicalId" | "canonicalSessionName" | "lastActivityAt" | "agentActivity" | "activityState">, sourceOrder: number): HealthEvidenceReference;
export declare function adaptContextUsageEvidence(nodeId: string, usage: ContextUsage, sourceOrder: number): HealthEvidenceReference;
export declare function adaptOccupantModelEvidence(input: {
    sourceOrder: number;
    observedAt: string | null;
    nodeId: string;
    occupantGeneration: string | null;
    runtime: string | null;
    model: string | null;
}): HealthEvidenceReference;
export declare function adaptLifecycleReceiptEvidence(input: {
    sourceOrder: number;
    observedAt: string;
    receiptId: string;
    operation: string;
    outcome: string;
}): HealthEvidenceReference;
export declare function deriveHealthSourceFreshness(input: {
    evaluatedAt: string;
    newestSourceAt: string | null;
    maxAgeSeconds: number;
    available?: boolean;
    contradictory?: boolean;
}): HealthSourceFreshness;
/** Apply one bounded read window without reordering or mutating source records. */
export declare function boundHealthEvidence(evidence: readonly HealthEvidenceReference[], query: HealthQueryBounds, freshness: HealthSourceFreshness): BoundedHealthEvidence;
/** Build one projection-neutral record. Detector policy supplies the draft; this function
 * enforces identity, bounds, freshness, and honest indeterminate semantics only. */
export declare function projectHealthRecord(draft: HealthRecordDraft): HealthRecord;
export declare function healthEpisodeId(detector: string, scope: HealthScope, episodeStartedAt: string, episodeKey?: string): string;
/** Canonical bytes for daemon, CLI, TUI, fixtures, and content-addressed tests. */
export declare function canonicalHealthJson(records: readonly HealthRecord[]): string;
export {};
//# sourceMappingURL=health-projection.d.ts.map