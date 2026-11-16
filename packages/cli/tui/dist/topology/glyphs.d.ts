import type { Token } from "../theme.js";
import type { GraphNodeData } from "./graph-types.js";
export interface StatusGlyph {
    glyph: "●" | "◐" | "○" | "✕";
    token: Token;
    /** ctx% overlay text ("63%") when the ◐ bucket has a served percentage */
    overlay: string | null;
}
export declare function statusGlyph(data: GraphNodeData): StatusGlyph;
/** S19 round-4 (guard finding 4): the EXPLORER row's status glyph+role,
 * folded from the SERVED AgentRow status vocabulary (hydrate.toAgentRow
 * derives it verbatim from the projection: failed / attention_required /
 * needs_input / active / idle / sessionStatus-or-"unknown"; the demo fixture
 * additionally uses the legacy "needs-attention" spelling). Same honest
 * 4-glyph vocabulary + activity roles as the topology statusGlyph — anything
 * not positively known renders ○, never a fabricated ●. */
export declare function rowStatusGlyph(agent: {
    status: string;
}): Pick<StatusGlyph, "glyph" | "token">;
export declare function edgeToken(kind: string): Token;
//# sourceMappingURL=glyphs.d.ts.map