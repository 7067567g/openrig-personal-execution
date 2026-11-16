import type Database from "better-sqlite3";
import type { DiscoveredSession, DiscoveryStatus, RuntimeHint, Confidence } from "./discovery-types.js";
export interface UpsertData {
    tmuxSession: string;
    tmuxPane: string;
    tmuxWindow?: string;
    pid?: number;
    cwd?: string;
    activeCommand?: string;
    runtimeHint: RuntimeHint;
    confidence: Confidence;
    evidenceJson?: string;
    configJson?: string;
}
export declare class DiscoveryRepository {
    readonly db: Database.Database;
    constructor(db: Database.Database);
    /** Upsert: preserve id + first_seen_at on rescan, update mutable fields. */
    upsertDiscoveredSession(data: UpsertData): DiscoveredSession;
    markVanished(ids: string[]): void;
    markClaimed(id: string, nodeId: string): void;
    releaseClaimByNodeId(nodeId: string): void;
    listDiscovered(status?: DiscoveryStatus): DiscoveredSession[];
    getDiscoveredSession(id: string): DiscoveredSession | null;
    /** Get IDs of all active discovered sessions */
    getActiveIds(): string[];
    /** Get active session by tmux identity */
    getByTmuxIdentity(tmuxSession: string, tmuxPane: string): DiscoveredSession | null;
    private rowToSession;
}
//# sourceMappingURL=discovery-repository.d.ts.map