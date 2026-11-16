export class GraphCanvas {
    width;
    grid = [];
    zones = [];
    constructor(width) {
        this.width = width;
    }
    row(y) {
        while (this.grid.length <= y)
            this.grid.push([]);
        return this.grid[y];
    }
    set(x, y, ch, token, bold, bg) {
        if (x < 0 || x >= this.width || y < 0)
            return;
        const row = this.row(y);
        while (row.length <= x)
            row.push({ ch: " " });
        row[x] = { ch, ...(token ? { token } : {}), ...(bold ? { bold } : {}), ...(bg ? { bg } : {}) };
    }
    /** read the plain character at (x, y) — " " when unset */
    charAt(x, y) {
        return this.grid[y]?.[x]?.ch ?? " ";
    }
    text(x, y, text, token, bold) {
        for (let i = 0; i < text.length; i++)
            this.set(x + i, y, text[i], token, bold);
    }
    hline(x1, x2, y, ch, token) {
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            // box-drawing crossings: a vertical run already present becomes ┼
            const existing = this.charAt(x, y);
            this.set(x, y, existing === "│" ? "┼" : ch, token);
        }
    }
    vline(x, y1, y2, ch, token) {
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            const existing = this.charAt(x, y);
            this.set(x, y, existing === "─" ? "┼" : ch, token);
        }
    }
    protectedRects = [];
    /** true when (x, y) lies inside a drawn box (border or interior) */
    isProtected(x, y) {
        return this.protectedRects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    }
    /** rectangle border in light (─│┌┐└┘) or double (═║╔╗╚╝) box-drawing.
     * The FULL rect is cleared first and marked protected: boxes are OPAQUE —
     * edge lines drawn earlier never show through an interior, and sub-cell
     * (braille) passes must not dot inside them. */
    box(x, y, w, h, token, double = false, protect = true) {
        for (let row = y; row < y + h; row++)
            for (let col = x; col < x + w; col++)
                this.set(col, row, " ");
        if (protect)
            this.protectedRects.push({ x, y, w, h });
        const [hz, vt, tl, tr, bl, br] = double ? ["═", "║", "╔", "╗", "╚", "╝"] : ["─", "│", "┌", "┐", "└", "┘"];
        this.hline(x + 1, x + w - 2, y, hz, token);
        this.hline(x + 1, x + w - 2, y + h - 1, hz, token);
        this.vline(x, y + 1, y + h - 2, vt, token);
        this.vline(x + w - 1, y + 1, y + h - 2, vt, token);
        this.set(x, y, tl, token);
        this.set(x + w - 1, y, tr, token);
        this.set(x, y + h - 1, bl, token);
        this.set(x + w - 1, y + h - 1, br, token);
    }
    zone(y, start, end, action) {
        // R2 c47219f1: hit zones derive from the SAME viewport-clipped truth as
        // pixels — a fully offscreen region records NO zone (never keyboard-
        // selectable/actionable), a partially visible one keeps only its visible,
        // mouse-reachable extent.
        if (start >= this.width)
            return;
        this.zones.push({ y, start, end: Math.min(end, this.width), action });
    }
    get height() {
        return this.grid.length;
    }
    /** per-line token segments — the paint layer (stylize) renders these with
     * ITS Style instance; plain(segs) === plainLines()[y] BY CONSTRUCTION, so
     * the shipped strip-invariant holds structurally */
    segLines() {
        return this.grid.map((row) => {
            const segs = [];
            const cells = [...row];
            while (cells.length < this.width)
                cells.push({ ch: " " });
            for (const cell of cells.slice(0, this.width)) {
                const last = segs.at(-1);
                if (last && last.token === cell.token && last.bold === cell.bold && last.bg === cell.bg)
                    last.text += cell.ch;
                else
                    segs.push({ text: cell.ch, ...(cell.token ? { token: cell.token } : {}), ...(cell.bold ? { bold: cell.bold } : {}), ...(cell.bg ? { bg: cell.bg } : {}) });
            }
            return segs;
        });
    }
    plainLines() {
        return this.grid.map((row) => row.map((cell) => cell.ch).join("").padEnd(this.width, " ").slice(0, this.width));
    }
    paintedLines(style) {
        return this.grid.map((row) => {
            let out = "";
            let run = "";
            let runToken;
            let runBold;
            let runBg;
            const flush = () => {
                if (run === "")
                    return;
                out += runToken || runBg ? style.paint(runToken ?? "bright", run, { ...(runBold ? { bold: true } : {}), ...(runBg ? { bg: runBg } : {}) }) : run;
                run = "";
            };
            const cells = [...row];
            while (cells.length < this.width)
                cells.push({ ch: " " });
            for (const cell of cells.slice(0, this.width)) {
                if (cell.token !== runToken || cell.bold !== runBold || cell.bg !== runBg) {
                    flush();
                    runToken = cell.token;
                    runBold = cell.bold;
                    runBg = cell.bg;
                }
                run += cell.ch;
            }
            flush();
            return out;
        });
    }
}
//# sourceMappingURL=canvas.js.map