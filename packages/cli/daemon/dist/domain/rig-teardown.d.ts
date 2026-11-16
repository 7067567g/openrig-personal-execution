import type Database from "better-sqlite3";
import type { RigRepository } from "./rig-repository.js";
import type { SessionRegistry } from "./session-registry.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { SnapshotCapture } from "./snapshot-capture.js";
import type { EventBus } from "./event-bus.js";
import type { ResumeMetadataRefresher } from "./resume-metadata-refresher.js";
export interface TeardownResult {
    rigId: string;
    sessionsKilled: number;
    snapshotId: string | null;
    deleted: boolean;
    deleteBlocked: boolean;
    alreadyStopped: boolean;
    errors: string[];
}
interface TeardownOptions {
    delete?: boolean;
    /** Reserved for future graceful-stop support. Currently a no-op because
     *  tmux kill-session is already immediate — there is no graceful stop to skip. */
    force?: boolean;
    snapshot?: boolean;
}
interface TeardownDeps {
    db: Database.Database;
    rigRepo: RigRepository;
    sessionRegistry: SessionRegistry;
    tmuxAdapter: TmuxAdapter;
    snapshotCapture: SnapshotCapture;
    eventBus: EventBus;
    resumeMetadataRefresher?: ResumeMetadataRefresher;
    serviceOrchestrator?: import("./service-orchestrator.js").ServiceOrchestrator;
}
/**
 * Graceful rig shutdown. Kills tmux sessions, clears bindings, marks
 * sessions exited. Optionally snapshots before teardown, optionally
 * deletes rig record.
 */
export declare class RigTeardownOrchestrator {
    readonly db: Database.Database;
    private deps;
    constructor(deps: TeardownDeps);
    teardown(rigId: string, opts?: TeardownOptions): Promise<TeardownResult>;
    /** Atomically record the supported stop and clear its binding. */
    private atomicNodeCleanup;
    /** An explicit down also covers already-detached seats, but neither a stale
     * row nor an unavailable probe proves that its session is absent. */
    private recordAlreadyStoppedIntent;
    /** Atomically delete rig + persist rig.deleted event */
    private atomicDelete;
    /** Get latest session per node, filtered to live statuses.
     *  OPR.0.4.3.20 FR-4 — delegates to the shared SessionRegistry method so the
     *  teardown pre-down path and the periodic/manual snapshot refresh share ONE query. */
    private getLatestLiveSessions;
    private liveGuidanceTargets;
    private cleanupManagedGuidanceFiles;
    private guidanceTargetPath;
    private guidancePathKey;
    private cleanupManagedGuidanceFileForNode;
}
export {};
//# sourceMappingURL=rig-teardown.d.ts.map