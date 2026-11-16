import type { ComposedMissionReview } from "./types.js";
export interface BriefSpine {
    building: string;
    progress: string;
    proven: string;
    needsYou: string;
}
/** The four generated section bodies — derived from the same composer
 *  queries FR-7 renders (no second computation path). */
export declare function renderBriefSpine(m: ComposedMissionReview): BriefSpine;
/**
 * Section-scoped application: replaces ONLY the four spine section bodies in
 * an existing MISSION_BRIEF.md, preserving every other byte (hand-authored
 * "What & why"/"Pointers", the H1, frontmatter, ordering). Returns null when
 * the brief does not carry the pinned schema (never guess-rewrite a
 * malformed brief — the audit owns that finding).
 */
export declare function applyBriefSpine(briefContent: string, spine: BriefSpine): string | null;
//# sourceMappingURL=brief-spine.d.ts.map