import type Database from "better-sqlite3";
import type { SessionRegistry } from "../session-registry.js";
import type { RigRepository } from "../rig-repository.js";
import { type AgentImageManifest } from "./agent-image-types.js";
import { AgentImageLibraryService } from "./agent-image-library-service.js";
export interface CaptureSnapshotOpts {
    sourceSession: string;
    name: string;
    version?: string;
    notes?: string;
    estimatedTokens?: number;
    lineage?: string[];
    files?: Map<string, string>;
}
export interface CaptureSnapshotResult {
    imageId: string;
    imagePath: string;
    manifest: AgentImageManifest;
}
export interface SnapshotCapturerDeps {
    db: Database.Database;
    rigRepo: RigRepository;
    sessionRegistry: SessionRegistry;
    agentImageLibrary: AgentImageLibraryService;
    /** Target install root — typically ~/.openrig/agent-images/. */
    targetRoot: string;
    /** Test seam — defaults to () => new Date(). */
    now?: () => Date;
}
export declare class SnapshotCapturer {
    private readonly deps;
    private readonly now;
    constructor(deps: SnapshotCapturerDeps);
    capture(opts: CaptureSnapshotOpts): CaptureSnapshotResult;
}
//# sourceMappingURL=snapshot-capturer.d.ts.map