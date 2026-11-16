export class ProcessCensus {
    listFn;
    freshnessMs;
    now;
    inFlight = null;
    lastRows = null;
    lastAt = -Infinity;
    constructor(opts = {}) {
        this.listFn = opts.list ?? defaultCensusList;
        this.freshnessMs = opts.freshnessMs ?? 2_000;
        this.now = opts.now ?? Date.now;
    }
    async list() {
        if (this.lastRows && this.now() - this.lastAt <= this.freshnessMs) {
            return this.lastRows;
        }
        if (this.inFlight)
            return this.inFlight;
        this.inFlight = this.listFn().then((rows) => {
            this.lastRows = rows;
            this.lastAt = this.now();
            this.inFlight = null;
            return rows;
        }, (err) => {
            // Honest failure: nothing cached, next call retries.
            this.inFlight = null;
            throw err;
        });
        return this.inFlight;
    }
    /** A CYCLE-SCOPED lister: at most one census underneath for the closure's
     *  lifetime, lazily fetched (a cycle with nothing to read spawns nothing).
     *  This is the "at most one per poll/tick" guarantee (mini-reqs 1-2) —
     *  stronger than the freshness window, which a slow cycle could outlive. */
    cycleLister() {
        let cycle = null;
        return () => (cycle ??= this.list());
    }
}
async function defaultCensusList() {
    // r2-B2: the STRICT lister — a failed `ps` must REJECT here so the census's
    // honest-failure path is reachable in production (the lenient variant's []
    // would have been cached as an empty SUCCESS for the freshness window).
    const { defaultListProcessesStrict } = await import("./resume-metadata-refresher.js");
    return defaultListProcessesStrict();
}
//# sourceMappingURL=process-census.js.map