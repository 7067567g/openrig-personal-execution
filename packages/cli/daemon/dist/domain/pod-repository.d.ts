import type Database from "better-sqlite3";
import type { Pod } from "./types.js";
interface PodOptions {
    summary?: string;
    continuityPolicyJson?: string;
}
/**
 * CRUD repository for pods (bounded context domains within a rig).
 * @param db - shared database handle
 */
export declare class PodRepository {
    readonly db: Database.Database;
    constructor(db: Database.Database);
    /**
     * Create a pod within a rig.
     * @param rigId - parent rig id
     * @param label - human-readable pod label
     * @param opts - optional summary and continuity policy JSON
     * @returns the created Pod
     */
    createPod(rigId: string, namespace: string, label: string, opts?: PodOptions): Pod;
    /**
     * Get a pod by id.
     * @param podId - pod id
     * @returns Pod or null if not found
     */
    getPod(podId: string): Pod | null;
    /** Get a pod by rig and authored namespace. Returns null if not found. */
    getPodByNamespace(rigId: string, namespace: string): Pod | null;
    /**
     * Get all pods for a rig.
     * @param rigId - rig id
     * @returns array of Pods ordered by creation time
     */
    getPodsForRig(rigId: string): Pod[];
    /**
     * Delete a pod by id.
     * Nodes with this pod_id will have pod_id set to NULL (ON DELETE SET NULL).
     * @param podId - pod id
     */
    deletePod(podId: string): void;
    getContinuityStatesForRig(rigId: string): import("./types.js").ContinuityState[];
    updateContinuityState(podId: string, nodeId: string, status: "healthy" | "degraded" | "restoring", artifactsJson?: string): void;
    private rowToPod;
}
export {};
//# sourceMappingURL=pod-repository.d.ts.map