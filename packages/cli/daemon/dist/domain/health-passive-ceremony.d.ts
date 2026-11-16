import type { QueueRepository } from "./queue-repository.js";
import type { HealthCheckpointSource } from "./health-checkpoints.js";
import type { OperatingPostureService } from "./rig-mode/operating-posture.js";
import { type HealthPolicyStore } from "./health-policy.js";
import type { HealthDetectorObservation, HealthObservationSource, HealthSourceCoverage } from "./health-detectors.js";
/** A read-only question generator. Proof files, closures and acceptance receipts
 * are material for the diagnosing agent, never an automatic outcome counter. */
export declare class PassiveCeremonySource implements HealthObservationSource {
    private readonly workspace;
    private readonly queue;
    private readonly policy;
    private readonly now;
    private readonly checkpoints?;
    private readonly posture?;
    readonly name = "passive-ceremony";
    readonly detectors: string[];
    constructor(workspace: string, queue: QueueRepository, policy: HealthPolicyStore, now?: () => string, checkpoints?: HealthCheckpointSource | undefined, posture?: {
        reader: OperatingPostureService;
        instanceId: string;
    } | undefined);
    private lastCoverage;
    coverage(): HealthSourceCoverage[];
    read(): HealthDetectorObservation[];
    private closedBoundaries;
    private assessment;
    private projectContext;
    private context;
}
//# sourceMappingURL=health-passive-ceremony.d.ts.map