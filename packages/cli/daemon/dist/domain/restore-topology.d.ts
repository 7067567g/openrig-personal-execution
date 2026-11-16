import type { RestoreExcludedNode, SnapshotData } from "./types.js";
export interface SnapshotRestoreTopology {
    intendedNodes: SnapshotData["nodes"];
    intendedRoster: Array<{
        nodeId: string;
        logicalId: string;
    }>;
    excludedNodes: RestoreExcludedNode[];
    invalidRosterIds: string[];
}
/** Resolve immutable attempt membership from the snapshot itself. Legacy
 * snapshots predate the roster and retain their former all-node behavior. */
export declare function resolveSnapshotRestoreTopology(data: SnapshotData): SnapshotRestoreTopology;
//# sourceMappingURL=restore-topology.d.ts.map