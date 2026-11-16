import type { QueueRepository } from "./queue-repository.js";
import { type HealthPolicyStore } from "./health-policy.js";
import { type HealthScope } from "./health-projection.js";
import type { HealthDetectorObservation, HealthObservationSource } from "./health-detectors.js";
/** Authored outcome-boundary census, not a per-edit event feed. Queue references
 * are verified locally; product/authority meaning remains attributed testimony. */
export interface HealthCheckpoint {
    schema: "openrig.health-checkpoint/v0alpha1";
    lineageQitemId: string;
    includeHandoffs?: boolean;
    scope: HealthScope;
    startedAt: string;
    observedAt: string;
    transitionIds: number[];
    productOutcomes: Array<{
        id: string;
        observedAt: string;
        evidenceRef: string;
    }>;
    productCensusRef: string;
    boundedAuthority: {
        applies: boolean | null;
        evidenceRef: string;
    };
    sdlc?: {
        expectation: string;
        evidenceRef: string;
    };
    authorityPaths: {
        project: string[];
        mission: string[];
        slice: string[];
    };
}
interface StoredCheckpoint {
    actor: string;
    checkpoint: HealthCheckpoint;
    episodeStartedAt: string;
    active: boolean;
    qualifying: HealthCheckpoint | null;
}
export declare class HealthCheckpointSource implements HealthObservationSource {
    private readonly queue;
    private readonly policy;
    private readonly now;
    private readonly workspace;
    readonly name = "health-checkpoints";
    readonly detectors: string[];
    private readonly dir;
    constructor(home: string, queue: QueueRepository, policy: HealthPolicyStore, now?: () => string, workspace?: string);
    private validate;
    private transitions;
    private file;
    submit(value: unknown, actor: string): StoredCheckpoint;
    entries(): StoredCheckpoint[];
    read(): HealthDetectorObservation[];
}
export {};
//# sourceMappingURL=health-checkpoints.d.ts.map