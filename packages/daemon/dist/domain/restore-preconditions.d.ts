import type { SnapshotData, RestoreValidationBlocker, RigServicesRecord } from "./types.js";
export declare function validatePreRestore(data: SnapshotData, opts: {
    fsOps?: {
        exists(path: string): boolean;
    };
    servicesRecord?: RigServicesRecord | null;
    freshLogicalIds?: string[];
    /** The runtime each seat has now, by logical id. A seat not listed is read as its saved runtime. */
    currentRuntimes?: Record<string, string | null | undefined>;
}): {
    blockers: RestoreValidationBlocker[];
    warnings: string[];
};
//# sourceMappingURL=restore-preconditions.d.ts.map