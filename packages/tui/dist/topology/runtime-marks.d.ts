import type { Token } from "../theme.js";
export type ClawdPixel = 0 | 1 | 2;
/** the 16x16 pixel matrix, derived from the rect list (row-major) */
export declare function clawdGrid(): ClawdPixel[][];
export interface MarkSeg {
    text: string;
    token?: Token;
    bold?: boolean;
    /** background token for half/quadrant cells whose lower/other half differs */
    bg?: Token;
}
/** FAITHFUL form — 16 cells x 8 rows of half-blocks (▀ paints the top pixel
 * with fg and the bottom with bg): the detail-pane / prototype scale. */
export declare function clawdFaithfulRows(): MarkSeg[][];
export declare function clawdDownsample(cols: number, rows: number): MarkSeg[][];
/** FOUNDER ROUND-2 DESIGN (2026-08-04 via pm-lead): the row mark is a flat
 * claude-terracotta BLOCK with two short dark vertical eye bars centered —
 * no limbs/legs; color + face ARE the mark at 2-cell size. Exact source
 * values: body #ad6755, eyes #181818 (RuntimeMark.tsx). */
export declare function clawdFounderMark(): MarkSeg[];
/** PICKS-V4 clawd row mark (founder amendment, PICKS-OF-RECORD sha256-16
 * 14afeb74, 2026-08-04 — a bounded refinement INSIDE the locked square-with-
 * eyes direction): the eyes are literally the characters `><` — left eye `>`,
 * right eye `<`, pointing INWARD, squinty (reference image-cache 102).
 * Founder rationale verbatim: eyes at the far edges do not read as eyes;
 * inward angle brackets make it read as a FACE. Dark #181818 eyes ON the
 * #ad6755 terracotta field, unchanged. (Lineage: round-4 shipped the ▘▝
 * outer-quadrant pair; superseded by this amendment.) */
export declare function clawdSquareMark(): MarkSeg[];
/** ROUND-3 codex blue-hint CANDIDATES — PICKED at picks v4 (14afeb74):
 * CHEVRON-ONLY, on detail/topology surfaces only (founder delegated; pm-lead
 * ruled the most restrained option). codexMark() below now ships the chevron
 * form; this record keeps the presented variants for decision lineage. Each
 * variant uses the OFFICIAL sampled #6867aa (token codexBlue), never a
 * remembered value. */
export declare function codexHintVariants(): Record<"chevron" | "outline" | "none", MarkSeg[]>;
/** row-mark CANDIDATES for the mr7 pick — both are downsample outputs */
export declare function clawdMiniA(): MarkSeg[];
export declare function clawdMiniB(): MarkSeg[];
/** Codex: the `>_` prompt mark with the PICKS-V4 CHEVRON-ONLY blue hint
 * (item a, 14afeb74): the `>` carries the OFFICIAL sampled #6867aa; the `_`
 * stays light ink. Text stays exactly ASCII `>_` (web-identity: the SAME
 * mark, not a cousin; ❯ remains vetoed). This mark renders on detail +
 * topology surfaces only — the explorer carries no marks (locked). */
export declare function codexMark(): MarkSeg[];
/** terminal/tty runtime: dark cell + white `>_` — same family, inverted. */
export declare function terminalMark(): MarkSeg[];
/** the row-scale mark for a served runtime string (placeholder-safe default:
 * miniA for claude until the founder pick lands — swap point, one site) */
export declare function runtimeMarkSegs(runtime: string | null | undefined): MarkSeg[];
/** plain-text width of a mark (all marks are single-cell glyphs) */
export declare function markText(segs: MarkSeg[]): string;
//# sourceMappingURL=runtime-marks.d.ts.map