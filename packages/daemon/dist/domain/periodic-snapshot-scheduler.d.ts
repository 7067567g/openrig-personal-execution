import type Database from "better-sqlite3";
import type { SnapshotCapture } from "./snapshot-capture.js";
import type { SnapshotRepository } from "./snapshot-repository.js";
import type { SessionRegistry } from "./session-registry.js";
import type { ResumeMetadataRefresher } from "./resume-metadata-refresher.js";
import type { ProcessCensus } from "./process-census.js";
export interface PeriodicSnapshotSchedulerDeps {
    db: Database.Database;
    snapshotCapture: SnapshotCapture;
    snapshotRepo: SnapshotRepository;
    sessionRegistry?: SessionRegistry;
    resumeMetadataRefresher?: ResumeMetadataRefresher;
    /** OPR.0.5.3.10 mini-req 2 — ONE process census per tick for ALL rigs and
     *  seats (absent → the refresher's own lister, the pre-slice behavior). */
    processCensus?: ProcessCensus;
}
export declare class PeriodicSnapshotScheduler {
    private timer;
    private deps;
    private retentionKeep;
    private running;
    constructor(deps: PeriodicSnapshotSchedulerDeps);
    start(intervalMs: number, retentionKeep?: number): void;
    private scheduleLongInterval;
    stop(): void;
    get isActive(): boolean;
    tick(): Promise<void>;
    private getRunningNonArchivedRigs;
}
//# sourceMappingURL=periodic-snapshot-scheduler.d.ts.map