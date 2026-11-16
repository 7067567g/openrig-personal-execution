import type { Token } from "../theme.js";
import type { Action } from "../types.js";
import type { PulseModel, PulseExceptionSection, PulseLane } from "./pulse-model.js";
interface Seg {
    text: string;
    token?: Token;
    bold?: boolean;
    bg?: Token;
    inverse?: boolean;
}
interface Line {
    text: string;
    segs?: Seg[];
    selected?: boolean;
}
export declare function renderPulseTabStrip(): Line;
export declare function renderExceptionSection(section: PulseExceptionSection): Line[];
/** The `── NOW (n) ──… JUST FINISHED (n) ──… UP NEXT (n) ──` rule row (dim). */
export declare function renderLaneRule(lanes: [PulseLane, PulseLane, PulseLane]): Line;
/** Zip the three lanes into aligned column rows (max lane length). Selection is
 * carried on the individual PulseLaneRow (painted per-cell by laneCell), NOT at
 * the line level, so a selected cell highlights one lane only. */
export declare function renderLanes(lanes: [PulseLane, PulseLane, PulseLane]): Line[];
/** One selectable lane cell: its position in renderPulseView's line list, its
 * lane column's fixed x-span (1-based terminal columns), and the drill Action. */
export interface PulseLaneTarget {
    lane: number;
    row: number;
    lineIndex: number;
    x1: number;
    x2: number;
    action: Action;
}
/** The selectable lane cells in COLUMN-MAJOR order (all NOW rows, then JUST
 * FINISHED, then UP NEXT) — the flat domain PULSE selection walks with ↑↓, each
 * mapped to its line index in renderPulseView's output and its lane's fixed
 * column x-span. Rows with no action (the "…" overflow marker) are omitted; they
 * are not entities. This is the ONE place that knows the view's vertical layout,
 * so render.ts never re-derives the offset math. */
export declare function pulseLaneTargets(model: PulseModel): PulseLaneTarget[];
export declare function renderPulseFooter(f: PulseModel["footer"]): Line;
/** The whole PULSE view (increment 1: static from demoPulseModel). REUSABLE parts above. */
export declare function renderPulseView(model: PulseModel): Line[];
export {};
//# sourceMappingURL=render-pulse.d.ts.map