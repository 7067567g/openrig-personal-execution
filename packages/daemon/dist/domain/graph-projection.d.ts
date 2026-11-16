import type { RigWithRelations, Session, Binding, Pod, AgentActivity, SeatIdentityVerdict } from "./types.js";
export interface RigGraphInput extends RigWithRelations {
    sessions: Session[];
    pods?: Pod[];
}
export interface CurrentQitemSummary {
    qitemId: string;
    bodyExcerpt: string;
    tier: string | null;
}
interface RFNodeData {
    logicalId: string;
    podLabel?: string | null;
    podNamespace?: string | null;
    rigId: string;
    role: string | null;
    runtime: string | null;
    model: string | null;
    status: string | null;
    binding: Binding | null;
    nodeKind: "agent" | "infrastructure";
    startupStatus: "pending" | "ready" | "attention_required" | "failed" | null;
    canonicalSessionName: string | null;
    podId: string | null;
    restoreOutcome: string;
    oriented: string;
    resumeToken?: string | null;
    resolvedSpecName: string | null;
    profile: string | null;
    edgeCount: number;
    contextUsedPercentage: number | null;
    contextFresh: boolean;
    contextAvailability: string;
    contextTotalInputTokens: number | null;
    contextTotalOutputTokens: number | null;
    agentActivity?: AgentActivity | null;
    currentQitems?: CurrentQitemSummary[];
    terminalActive?: boolean | null;
    hasAssignedWork?: boolean;
    assignedWorkCount?: number;
    pendingWorkCount?: number;
    inProgressWorkCount?: number;
    blockedWorkCount?: number;
    /** OPR.0.4.3.19 — liveness identity verdict threaded through so the graph
     *  surfaces the same non-green mismatch/missing evidence as node inventory. */
    identityVerdict?: SeatIdentityVerdict | null;
    heldReason?: string | null;
}
interface RFNode {
    id: string;
    type: string;
    position: {
        x: number;
        y: number;
    };
    data: RFNodeData;
    parentId?: string;
}
interface RFEdge {
    id: string;
    source: string;
    target: string;
    label: string;
}
export interface ReactFlowGraph {
    nodes: RFNode[];
    edges: RFEdge[];
}
export interface InventoryOverlay {
    logicalId: string;
    startupStatus: "pending" | "ready" | "attention_required" | "failed" | null;
    canonicalSessionName: string | null;
    restoreOutcome: string;
    oriented?: string;
    contextUsedPercentage?: number | null;
    contextFresh?: boolean;
    contextAvailability?: string;
    contextTotalInputTokens?: number | null;
    contextTotalOutputTokens?: number | null;
    agentActivity?: AgentActivity | null;
    currentQitems?: CurrentQitemSummary[];
    terminalActive?: boolean | null;
    hasAssignedWork?: boolean;
    assignedWorkCount?: number;
    pendingWorkCount?: number;
    inProgressWorkCount?: number;
    blockedWorkCount?: number;
    identityVerdict?: SeatIdentityVerdict | null;
    heldReason?: string | null;
}
export declare function projectRigToGraph(input: RigGraphInput, inventoryOverlay?: InventoryOverlay[]): ReactFlowGraph;
export {};
//# sourceMappingURL=graph-projection.d.ts.map