import { layoutGraph } from "./layout.js";
import { renderHatchet } from "./styles/hatchet.js";
import { renderBraille } from "./styles/braille.js";
export const GRAPH_STYLE_NAMES = ["hatchet", "braille", "braille-fallback"];
export function isGraphStyle(value) {
    return GRAPH_STYLE_NAMES.includes(value);
}
export function renderGraphStyle(style, graph, ctx, width) {
    switch (style) {
        case "braille":
            return renderBraille(layoutGraph(graph, width, ctx.rig), ctx, width, false);
        case "braille-fallback":
            return renderBraille(layoutGraph(graph, width, ctx.rig), ctx, width, true);
        default:
            // hatchet is the mainline AND the unknown-style safety floor — the
            // reducer already rejects unknown names before render (one surface)
            return renderHatchet(layoutGraph(graph, width, ctx.rig), ctx, width);
    }
}
//# sourceMappingURL=render-graph.js.map