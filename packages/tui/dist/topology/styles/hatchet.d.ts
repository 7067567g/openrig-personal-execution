import { GraphCanvas } from "../canvas.js";
import { edgeToken } from "../glyphs.js";
import type { GraphLayout, PlacedNode } from "../layout.js";
import type { Action } from "../../types.js";
export interface StyleContext {
    /** host/rig names for drill actions (the SAME Action vocabulary every
     * adapter dispatches — PIN-1) */
    host: string;
    rig: string;
    /** logicalId of the selected node (accent border, like Hatchet) */
    selected?: string | null;
}
export declare function drillAction(node: PlacedNode, ctx: StyleContext): Action;
export declare function drawNodeBox(canvas: GraphCanvas, p: PlacedNode, ctx: StyleContext): void;
interface Arrow {
    x: number;
    y: number;
    ch: string;
    token: ReturnType<typeof edgeToken>;
}
/** straight orthogonal connector; the arrowhead is returned so the caller can
 * draw it LAST (it must survive the node boxes painting over line ends) */
type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export declare function drawEdge(canvas: GraphCanvas, from: PlacedNode, to: PlacedNode, kind: string, lane?: number, obstacles?: Rect[]): Arrow;
/** R2 HIGH-1: the LOCKED containment hierarchy drawn as real container boxes
 * — the rig (double border, name tab) wraps pod containers (light border,
 * ▾-name tab, header hit zone → drill pod) which wrap their agent boxes.
 * Containers are BACKGROUNDS (unprotected fills): edges may route across
 * their interiors; agent boxes stay opaque+protected on top. */
export declare function drawContainers(canvas: GraphCanvas, layout: GraphLayout, ctx: StyleContext): void;
export declare function renderHatchet(layout: GraphLayout, ctx: StyleContext, width: number): GraphCanvas;
/** MR8 width-clip honesty: the view never quietly loses right-side nodes —
 * an INDICATOR only (founder-scoped: no scroll, no rework, no cap) */
export declare function drawClipIndicator(canvas: GraphCanvas, layout: GraphLayout, width: number): void;
export {};
//# sourceMappingURL=hatchet.d.ts.map