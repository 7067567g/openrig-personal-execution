export interface GraphNodeData {
    logicalId: string;
    podNamespace?: string | null;
    podLabel?: string | null;
    runtime: string | null;
    model: string | null;
    /** latest session status verbatim (null = no session) */
    status: string | null;
    nodeKind: "agent" | "infrastructure";
    startupStatus: "pending" | "ready" | "attention_required" | "failed" | null;
    contextUsedPercentage: number | null;
    agentActivity?: {
        state?: string;
    } | null;
    terminalActive?: boolean | null;
    heldReason?: string | null;
    canonicalSessionName?: string | null;
}
export interface GraphNode {
    id: string;
    /** "podGroup" (pod container) or "rigNode" (agent/infrastructure seat) */
    type: string;
    parentId?: string;
    data: GraphNodeData;
}
export interface GraphEdge {
    id: string;
    /** node ids (NOT logicalIds) — join through GraphNode.id */
    source: string;
    target: string;
    /** the served edge KIND string (e.g. delegates_to) — the daemon serializes
     * it under `label`; the spike renders it as line COLOR, never as text */
    label: string;
}
export interface RigGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
}
//# sourceMappingURL=graph-types.d.ts.map