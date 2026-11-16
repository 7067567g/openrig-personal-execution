import type Database from "better-sqlite3";
import type { RigRepository } from "./rig-repository.js";
import type { SessionRegistry } from "./session-registry.js";
import type { DiscoveryRepository } from "./discovery-repository.js";
import type { EventBus } from "./event-bus.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { QueueRepository } from "./queue-repository.js";
export type UnclaimSessionResult = {
    ok: true;
    rigId: string;
    nodeId: string;
    logicalId: string;
    sessionId: string;
    sessionName: string;
} | {
    ok: false;
    code: "session_not_found" | "session_ambiguous" | "session_not_current";
    error: string;
};
export type RemoveNodeResult = {
    ok: true;
    rigId: string;
    nodeId: string;
    logicalId: string;
    sessionsKilled: number;
    /** #174: the session name belonged to another node's seat (logical id @ rig), so it was kept. */
    sessionKeptFor?: string;
    fallbackDestination?: string;
    reroutedQitemIds: string[];
} | {
    ok: false;
    code: "rig_not_found" | "node_not_found" | "active_qitems" | "fallback_not_running" | "fallback_in_target" | "kill_failed";
    error: string;
    activeQitemIds?: string[];
    fallbackDestination?: string;
    reroutedQitemIds?: string[];
    sessionsKilled?: number;
    /** Set when the node was kept for late queue work after its session had already stopped. */
    retained?: true;
    sessionStopped?: boolean;
};
type ShrinkNodeOutcome = {
    nodeId: string;
    logicalId: string;
    status: "removed" | "failed";
    sessionsKilled: number;
    sessionKeptFor?: string;
    code?: Exclude<RemoveNodeResult, {
        ok: true;
    }>["code"];
    retained?: true;
    sessionStopped?: boolean;
    activeQitemIds?: string[];
    error?: string;
};
export type ReleaseRigResult = {
    ok: true;
    status: "ok" | "partial";
    rigId: string;
    deleted: boolean;
    released: Array<{
        nodeId: string;
        logicalId: string;
        sessionId: string;
        sessionName: string;
    }>;
    failed: Array<{
        nodeId: string;
        logicalId: string;
        sessionId: string | null;
        sessionName: string | null;
        error: string;
    }>;
} | {
    ok: false;
    code: "rig_not_found" | "contains_launched_nodes";
    error: string;
    launchedLogicalIds?: string[];
};
export type ShrinkPodResult = {
    ok: true;
    status: "ok" | "partial";
    rigId: string;
    podId: string;
    namespace: string;
    removedLogicalIds: string[];
    sessionsKilled: number;
    fallbackDestination?: string;
    reroutedQitemIds: string[];
    nodes: ShrinkNodeOutcome[];
} | {
    ok: false;
    code: "rig_not_found" | "pod_not_found" | "active_qitems" | "fallback_not_running" | "fallback_in_target" | "kill_failed";
    error: string;
    activeQitemIds?: string[];
    fallbackDestination?: string;
    reroutedQitemIds?: string[];
    sessionsKilled?: number;
    nodes?: ShrinkNodeOutcome[];
};
interface RigLifecycleDeps {
    db: Database.Database;
    rigRepo: RigRepository;
    sessionRegistry: SessionRegistry;
    discoveryRepo: DiscoveryRepository;
    eventBus: EventBus;
    queueRepo: QueueRepository;
    tmuxAdapter?: TmuxAdapter;
}
export declare class RigLifecycleService {
    readonly db: Database.Database;
    private readonly rigRepo;
    private readonly sessionRegistry;
    private readonly discoveryRepo;
    private readonly eventBus;
    private readonly queueRepo;
    private readonly tmuxAdapter;
    constructor(deps: RigLifecycleDeps);
    /** Release a current claimed session without killing its external process. */
    unclaimSession(sessionRef: string): Promise<UnclaimSessionResult>;
    /** Release adopted seats under their lifecycle leases, optionally deleting the rig. */
    releaseRig(rigId: string, opts?: {
        delete?: boolean;
    }): Promise<ReleaseRigResult>;
    removeNode(rigId: string, nodeRef: string, opts?: {
        fallbackDestination?: string;
    }): Promise<RemoveNodeResult>;
    /**
     * `shrinkTarget` is set when a pod shrink removes its members: the shrink has already validated the
     * fallback once for the whole pod, so a member revalidates it only when its own work needs rerouting.
     */
    private removeNodeWithin;
    shrinkPod(rigId: string, podRef: string, opts?: {
        fallbackDestination?: string;
    }): Promise<ShrinkPodResult>;
    /** A member failure during a shrink, restated so it doesn't deny effects the shrink already applied. */
    private withShrinkEffects;
    private activeQitemIdsForSessionNames;
    private activeQitemsError;
    private validateFallbackDestination;
    private resolveNodeRef;
    private resolvePodRef;
}
export {};
//# sourceMappingURL=rig-lifecycle-service.d.ts.map