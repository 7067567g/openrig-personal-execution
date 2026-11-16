import { type EffectiveHealthPolicy, type HealthPolicy } from "./health-policy.js";
import type Database from "better-sqlite3";
import { type BoundedHealthEvidence, type HealthConfidence, type HealthRecord, type PassiveCeremony, type HealthScope, type HealthSeverity, type HealthStatus } from "./health-projection.js";
import type { ContextUsageStore } from "./context-usage-store.js";
import type { RigRepository } from "./rig-repository.js";
import type { SessionRegistry } from "./session-registry.js";
export declare const HEALTH_LIST_SCHEMA: "openrig.health-list/v0alpha1";
interface ObservationBase {
    episodeKey?: string;
    ceremony?: PassiveCeremony;
    conditionCleared?: boolean;
    confidence?: HealthConfidence;
    sourceDescription?: string;
    scope: HealthScope;
    episodeStartedAt: string;
    lastObservedAt: string;
    source: BoundedHealthEvidence;
}
export type HealthDetectorObservation = (ObservationBase & {
    kind: "coordination-lineage";
    lineageId: string;
    coordinationTransitions: number;
    productStateChanges: number | null;
    boundedAuthority: boolean;
    reviewReturns: number;
    candidateChanges: number;
    newRiskClasses: number;
}) | (ObservationBase & {
    kind: "wake-lineage";
    lineageId: string;
    wakeCount: number;
    rescueWakeCount: number;
    existingNextAction: boolean;
}) | (ObservationBase & {
    kind: "directive";
    directiveId: string;
    declaredPhase: string | null;
    currentPhase: string | null;
    declaredRigor: string | null;
    currentRigor: string | null;
    conflictSourceAddress: string | null;
}) | (ObservationBase & {
    kind: "scope-admission";
    sliceId: string;
    missionActive: boolean;
    buildable: boolean;
    requiredAuthority: string | null;
    admissionAuthority: string | null;
    admissionState: "present" | "missing" | "contradictory" | "unavailable";
    authoritySourceAddress: string | null;
}) | (ObservationBase & {
    kind: "context-pressure";
    sourceName: string | null;
    continuity: string | null;
    warningPercent?: number;
    criticalPercent?: number;
});
/** How much of its input a source actually evaluated on its latest read. Omitted
 * items were not evaluated; their absence from the findings is not a healthy verdict. */
export type HealthSourceCoverage = {
    source: string;
    evaluatedAt: string;
    status: "unavailable";
    partial: true;
    reason: string;
} | {
    status?: "available";
    source: string;
    evaluatedAt: string;
    unit: string;
    limit: number;
    total: number;
    evaluated: number;
    omitted: number;
    partial: boolean;
    order: string;
};
export interface HealthObservationSource {
    readonly name?: string;
    /** All detectors this reader can supply. Skip the read when all are disabled. */
    readonly detectors?: readonly string[];
    read(): readonly HealthDetectorObservation[];
    /** Coverage of the latest read(), when the source bounds its input. */
    coverage?(): readonly HealthSourceCoverage[];
}
export interface HealthListQuery {
    limit?: number;
    scopeType?: HealthScope["type"];
    scopeId?: string;
    severity?: HealthSeverity;
    status?: HealthStatus;
}
export interface HealthListProjection {
    schema: typeof HEALTH_LIST_SCHEMA;
    evaluatedAt: string | null;
    total: number;
    limit: number;
    truncated: boolean;
    records: HealthRecord[];
    /** Present when a source bounded its input; see HealthSourceCoverage. */
    coverage?: HealthSourceCoverage[];
}
export declare function evaluateHealthDetectors(observations: readonly HealthDetectorObservation[], policy?: HealthPolicy): HealthRecord[];
export declare function canonicalDetectorJson(records: readonly HealthRecord[]): string;
export declare class HealthProjectionService {
    private readonly source;
    private readonly policy?;
    private readonly operatingPosture?;
    private lastCoverage;
    constructor(source: HealthObservationSource | readonly HealthObservationSource[], policy?: (() => EffectiveHealthPolicy) | undefined, operatingPosture?: ((record: HealthRecord) => NonNullable<HealthRecord["operatingPosture"]>) | undefined);
    records(): HealthRecord[];
    coverage(): HealthSourceCoverage[];
    list(query?: HealthListQuery): HealthListProjection;
    get(id: string): HealthRecord | null;
}
/** The live v1 adapter intentionally supplies only context observations. The other
 * detectors require structured product-change, directive, or admission facts that
 * current tables cannot express without inference. Replay sources can supply them. */
export declare class LiveContextHealthSource implements HealthObservationSource {
    private readonly deps;
    readonly name = "live-context";
    readonly detectors: string[];
    constructor(deps: {
        db: Database.Database;
        rigRepo: RigRepository;
        sessionRegistry: SessionRegistry;
        contextUsageStore: ContextUsageStore;
        resolveContextPressurePolicy?: () => {
            warningPercent: number;
            criticalPercent: number;
        };
        now?: () => Date;
    });
    read(): HealthDetectorObservation[];
}
export declare function healthScopeId(scope: HealthScope): string;
export {};
//# sourceMappingURL=health-detectors.d.ts.map