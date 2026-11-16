import type { ViewState } from "./types.js";
/** One page's successful HTTP reads; never shared between TUIs or used for effects.
 * Each source can fail without erasing siblings. */
export declare class PageRead {
    private now;
    private denied;
    private values;
    private seen;
    errors: string[];
    retainedAt: number | undefined;
    constructor(now: () => number, denied?: (url: string) => void);
    has(url: string): boolean;
    begin(): void;
    end(): void;
    fetch(fetchImpl: typeof fetch, signal: AbortSignal, optional?: boolean): typeof fetch;
}
/** Data coordinates only; scrolling, selection, filters and Help never evict a read. */
export declare function pageReadKey(s: ViewState): string;
//# sourceMappingURL=page-read.d.ts.map