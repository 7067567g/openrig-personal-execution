import type { Action } from "./types.js";
import type { Token } from "./theme.js";
export interface ContentLine {
    text: string;
    action?: Action;
    zones?: Array<{
        start: number;
        end: number;
        action: Action;
    }>;
    /** Explicit semantic paint runs. Their plain text must equal `text`. */
    segs?: Array<{
        text: string;
        token?: Token;
        bold?: boolean;
        bg?: Token;
        inverse?: boolean;
    }>;
}
/** Wrap prose and full references without losing a link's target. Graph/table rows
 * retain their own layout; callers opt in only for detail pages. */
export declare function wrapDetailLines(lines: ContentLine[], width: number): ContentLine[];
/** fixed label column — one rhythm across every detail page */
export declare const LABEL_W = 12;
export interface Field {
    label: string;
    value: string;
    /** clicking the row dispatches this (rendered with the standard affordance) */
    link?: Action;
}
export interface Section {
    title?: string;
    fields?: Field[];
    /** pre-built lines (lists, tables) that already follow the vocabulary */
    lines?: ContentLine[];
}
export declare function fieldLine(field: Field): ContentLine;
export declare function sectionRule(title: string, width?: number): ContentLine;
export declare function listItem(text: string, link?: Action, indent?: number): ContentLine;
/** Assemble a detail page: one spacing rhythm — a blank line before every
 * section rule except the first content block. */
export declare function detailPage(heading: ContentLine, sections: Section[]): ContentLine[];
/** Aligned columns for list-style pages (needs-you, hosts-down): the glance
 * win is fixed columns, not dash-run-ons. */
export declare function alignedRow(cols: Array<[string, number]>, tail?: string): string;
//# sourceMappingURL=detail.d.ts.map