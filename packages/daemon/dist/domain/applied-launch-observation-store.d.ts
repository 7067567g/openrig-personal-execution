import type Database from "better-sqlite3";
import type { AppliedLaunchObservation } from "./permission-drift.js";
export interface StoredAppliedLaunchObservation extends AppliedLaunchObservation {
    generationUuid: string;
    observedAt: string;
}
/**
 * Best-effort, generation-scoped persistence for the exact argument value
 * returned by a successful managed launch. Missing migrations and DB failures
 * degrade to UNKNOWN; they never turn a successful provider launch into a
 * failed launch.
 */
export declare class AppliedLaunchObservationStore {
    private readonly db;
    constructor(db: Database.Database);
    recordGeneration(generationUuid: string, observation: AppliedLaunchObservation): boolean;
    invalidateGeneration(generationUuid: string): boolean;
    readCurrent(nodeId: string): StoredAppliedLaunchObservation | null;
    /** readCurrent's daemon choice for every node that has one recorded, in one read; unknown nodes are absent. */
    readCurrentDaemonOptOuts(): Map<string, boolean>;
}
//# sourceMappingURL=applied-launch-observation-store.d.ts.map