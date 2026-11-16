import type { ProcessRow } from "./model-divergence/current-generation-record.js";
export interface ProcessCensusOpts {
    /** The underlying enumeration (default: the shared `ps -Ao` lister). */
    list?: () => Promise<ProcessRow[]>;
    /** Reuse window for a successful census. Default 2000ms. */
    freshnessMs?: number;
    /** Injectable clock (tests). */
    now?: () => number;
}
export declare class ProcessCensus {
    private readonly listFn;
    private readonly freshnessMs;
    private readonly now;
    private inFlight;
    private lastRows;
    private lastAt;
    constructor(opts?: ProcessCensusOpts);
    list(): Promise<ProcessRow[]>;
    /** A CYCLE-SCOPED lister: at most one census underneath for the closure's
     *  lifetime, lazily fetched (a cycle with nothing to read spawns nothing).
     *  This is the "at most one per poll/tick" guarantee (mini-reqs 1-2) —
     *  stronger than the freshness window, which a slow cycle could outlive. */
    cycleLister(): () => Promise<ProcessRow[]>;
}
//# sourceMappingURL=process-census.d.ts.map