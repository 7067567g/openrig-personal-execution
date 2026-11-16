import type Database from "better-sqlite3";
import type { Checkpoint } from "./types.js";
interface CreateCheckpointData {
    summary: string;
    currentTask?: string | null;
    nextStep?: string | null;
    blockedOn?: string | null;
    keyArtifacts?: string[];
    confidence?: string | null;
    podId?: string | null;
    continuitySource?: string | null;
    continuityArtifactsJson?: string | null;
}
export declare class CheckpointStore {
    readonly db: Database.Database;
    constructor(db: Database.Database);
    createCheckpoint(nodeId: string, data: CreateCheckpointData): Checkpoint;
    getLatestCheckpoint(nodeId: string): Checkpoint | null;
    getCheckpointsForNode(nodeId: string): Checkpoint[];
    getCheckpointsForRig(rigId: string): Record<string, Checkpoint | null>;
    private rowToCheckpoint;
}
export {};
//# sourceMappingURL=checkpoint-store.d.ts.map