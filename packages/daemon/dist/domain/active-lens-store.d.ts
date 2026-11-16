export interface ActiveLens {
    specName: string;
    specVersion: string;
    /** ISO timestamp of the most recent activation; useful for
     *  diagnostics + UI staleness display. */
    activatedAt: string;
}
export interface ActiveLensStoreOpts {
    /** Absolute file path. Should fall under the daemon's OPENRIG_HOME so
     *  the lens stays isolated per host. */
    filePath: string;
    /** Test seam — defaults to () => new Date(). */
    now?: () => Date;
}
export declare class ActiveLensStore {
    private readonly filePath;
    private readonly now;
    constructor(opts: ActiveLensStoreOpts);
    get(): ActiveLens | null;
    set(specName: string, specVersion: string): ActiveLens;
    clear(): void;
}
//# sourceMappingURL=active-lens-store.d.ts.map