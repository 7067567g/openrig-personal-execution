import type Database from "better-sqlite3";
import { type ProjectRead } from "./workspace/project-read.js";
import type { StreamStore } from "./stream-store.js";
export declare const sourceHash: (value: string) => string;
export interface ClassifierOccupant {
    nodeId: string;
    rigId: string;
    session: string;
    generation: string;
}
export declare function classifierOccupant(db: Database.Database, session: string): ClassifierOccupant | null;
export declare function classificationSources(db: Database.Database, project: ProjectRead, occupant: ClassifierOccupant, stream: StreamStore): {
    occupant: ClassifierOccupant;
    observedAt: string;
    version: string;
    sources: {
        project: {
            id: string;
            root: string;
            missionsRoot: string;
            files: {
                source: string;
                hash: string;
            }[];
        };
        scopes: {
            id: string;
            source: string;
            hash: string;
        }[];
        rosterSource: string;
        roster: ClassifierOccupant[];
        recent: {
            streamItemId: string;
            body: string;
            bodyTruncated: boolean;
            sourceSession: string;
            evidenceRef: string;
        }[];
    };
    unavailable: string[];
    duplicateCoverage: string;
};
//# sourceMappingURL=classification-sources.d.ts.map