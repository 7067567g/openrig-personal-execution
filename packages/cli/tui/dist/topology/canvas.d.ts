import type { Style, Token } from "../theme.js";
import type { Action } from "../types.js";
export interface CanvasZone {
    y: number;
    start: number;
    end: number;
    action: Action;
}
export declare class GraphCanvas {
    readonly width: number;
    private grid;
    readonly zones: CanvasZone[];
    constructor(width: number);
    private row;
    set(x: number, y: number, ch: string, token?: Token, bold?: boolean, bg?: Token): void;
    /** read the plain character at (x, y) — " " when unset */
    charAt(x: number, y: number): string;
    text(x: number, y: number, text: string, token?: Token, bold?: boolean): void;
    hline(x1: number, x2: number, y: number, ch: string, token?: Token): void;
    vline(x: number, y1: number, y2: number, ch: string, token?: Token): void;
    private readonly protectedRects;
    /** true when (x, y) lies inside a drawn box (border or interior) */
    isProtected(x: number, y: number): boolean;
    /** rectangle border in light (─│┌┐└┘) or double (═║╔╗╚╝) box-drawing.
     * The FULL rect is cleared first and marked protected: boxes are OPAQUE —
     * edge lines drawn earlier never show through an interior, and sub-cell
     * (braille) passes must not dot inside them. */
    box(x: number, y: number, w: number, h: number, token?: Token, double?: boolean, protect?: boolean): void;
    zone(y: number, start: number, end: number, action: Action): void;
    get height(): number;
    /** per-line token segments — the paint layer (stylize) renders these with
     * ITS Style instance; plain(segs) === plainLines()[y] BY CONSTRUCTION, so
     * the shipped strip-invariant holds structurally */
    segLines(): Array<Array<{
        text: string;
        token?: Token;
        bold?: boolean;
        bg?: Token;
    }>>;
    plainLines(): string[];
    paintedLines(style: Style): string[];
}
//# sourceMappingURL=canvas.d.ts.map