import { GraphCanvas } from "./canvas.js";
import { type StyleContext } from "./styles/hatchet.js";
import type { RigGraph } from "./graph-types.js";
export declare const GRAPH_STYLE_NAMES: readonly ["hatchet", "braille", "braille-fallback"];
export type GraphStyle = (typeof GRAPH_STYLE_NAMES)[number];
export declare function isGraphStyle(value: string): value is GraphStyle;
export declare function renderGraphStyle(style: string, graph: RigGraph, ctx: StyleContext, width: number): GraphCanvas;
//# sourceMappingURL=render-graph.d.ts.map