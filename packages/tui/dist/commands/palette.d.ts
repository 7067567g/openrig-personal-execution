import type { CommandEntry } from "./registry.js";
export interface PaletteRow {
    entry: CommandEntry;
    /** True when the entry's context is satisfied in the CURRENT context. */
    available: boolean;
    /** When unavailable: the honest reason naming the required context. */
    reason?: string;
    score: number;
}
export declare function filterPalette(query: string, registry: readonly CommandEntry[], currentContext: string): PaletteRow[];
/** The execute contract: argless entries EXECUTE their canonical line verbatim (byte-equal
 *  to typing it); argful entries PRE-FILL the command bar for completion — the palette
 *  never fabricates arguments. */
export declare function paletteExecuteLine(entry: CommandEntry): {
    mode: "execute" | "prefill";
    line: string;
};
//# sourceMappingURL=palette.d.ts.map