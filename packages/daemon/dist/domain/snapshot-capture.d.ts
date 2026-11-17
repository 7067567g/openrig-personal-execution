import type Database from "better-sqlite3";
import type { RigRepository } from "./rig-repository.js";
import type { SessionRegistry } from "./session-registry.js";
import type { EventBus } from "./event-bus.js";
import type { SnapshotRepository } from "./snapshot-repository.js";
import type { CheckpointStore } from "./checkpoint-store.js";
import type { Snapshot, SnapshotData } from "./types.js";
interface SnapshotCaptureDeps {
    db: Database.Database;
    rigRepo: RigRepository;
    sessionRegistry: SessionRegistry;
    eventBus: EventBus;
    snapshotRepo: SnapshotRepository;
    checkpointStore: CheckpointStore;
}
export declare class SnapshotCapture {
    readonly db: Database.Database;
    private rigRepo;
    private sessionRegistry;
    private eventBus;
    private snapshotRepo;
    private checkpointStore;
    constructor(deps: SnapshotCaptureDeps);
    /**
     * Build the exact snapshot payload without writing it. Read-only: used by
     * restore preflight so an invalid capture never becomes a persisted
     * `auto-rehydrate` row before structural validation.
     */
    prepareSnapshotData(rigId: string, kind: string, opts?: {
        intendedNodeIds?: string[];
    }): SnapshotData;
    captureSnapshot(rigId: string, kind: string, opts?: {
        intendedNodeIds?: string[];
        preparedData?: SnapshotData;
    }): Snapshot;
    private materializedRoster;
}
export {};
//# sourceMappingURL=snapshot-capture.d.ts.map