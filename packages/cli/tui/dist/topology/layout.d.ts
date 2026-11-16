import type { GraphEdge, GraphNode, RigGraph } from "./graph-types.js";
import { type StatusGlyph } from "./glyphs.js";
export interface PlacedNode {
    node: GraphNode;
    glyph: StatusGlyph;
    /** MEMBER-only display title (S19 MR1 — identity stays logicalId in every
     * zone/action; this is display only) */
    title: string;
    /** `● member  63%` and `runtime · ctx%` — the info INSIDE the node */
    nameLine: string;
    metaLine: string;
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface GraphContainer {
    kind: "rig" | "pod";
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface GraphLayout {
    placed: PlacedNode[];
    byId: Map<string, PlacedNode>;
    edges: GraphEdge[];
    /** R2 HIGH-1: the LOCKED containment hierarchy — the rig container wraps
     * pod containers, pod containers wrap their member agent boxes; renderers
     * MUST draw them (agent-in-pod-in-rig is a visible contract, not metadata) */
    containers: GraphContainer[];
    width: number;
    height: number;
    /** MR8: true when the laid-out extent exceeds the viewport width — the
     * renderer MUST show the honest clipped-content indicator */
    clipped: boolean;
}
export declare function agentNodes(graph: RigGraph): GraphNode[];
export declare function nodeLines(node: GraphNode): {
    glyph: StatusGlyph;
    title: string;
    nameLine: string;
    metaLine: string;
};
/** R2 HIGH-1 layout: pods are the clustering unit — each pod is a container
 * column holding its member agent boxes stacked vertically; pods order by the
 * min delegation rank of their members (delegation still reads left→right);
 * the rig container wraps everything. Ungrouped agents get a "(no pod)"
 * cluster so nothing served is ever dropped. */
export declare function layoutGraph(graph: RigGraph, maxWidth: number, rigName?: string): GraphLayout;
//# sourceMappingURL=layout.d.ts.map