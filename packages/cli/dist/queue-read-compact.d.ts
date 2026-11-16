/**
 * Slice 15 (OPR.0.7.0.15) P2 and P3 — the compact status reads `rig queue show` and
 * `rig queue transitions` print when the `output.compact` switch is on and `--full` was not given.
 * CLI-side projections of the daemon's response: routes are untouched, and with the switch off (the
 * default) or with `--full` both commands print today's output byte for byte.
 */
type Row = Record<string, unknown>;
/** P2: today's `show` preview without its empty fields. They are counted as one `readView.omittedFields`
 *  entry (so `readView.complete` turns false); naming each would cost more than the nulls it replaces.
 *  The full read is unchanged. */
export declare function compactShow(preview: Row): {
    item: Row;
    emptyOmitted: string[];
};
export declare function showEmptyNotice(emptyOmitted: string[], fullCommand: string): string;
/** How many of the latest transitions the compact log shows. */
export declare const TRANSITIONS_SHOWN = 5;
/**
 * P3: the latest transitions, in today's oldest-first order (so `.[-1]` is still the latest), always
 * including the transition that set the current disposition (its state change or closure, with its
 * note), even when later note-only updates push it past the tail. `earlier` counts what is left out.
 */
export declare function compactTransitions(log: Row[], shown?: number): {
    transitions: Row[];
    earlier: number;
};
export declare function transitionsNotice(earlier: number, total: number, fullCommand: string): string;
export {};
//# sourceMappingURL=queue-read-compact.d.ts.map