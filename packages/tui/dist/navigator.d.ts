import type { ExplorerRow, FleetSnapshot } from "./types.js";
import type { MarkSeg } from "./topology/runtime-marks.js";
export interface NavigatorMeta {
    /** column (within the DISPLAY label) where this run begins */
    start: number;
    /** token segments — a run's own colors (status role; formerly the mark's
     * bg channel) survive the paint layer through this channel (guard finding 2;
     * round-4: rows may carry SEVERAL runs — status badge + right meta) */
    segs: MarkSeg[];
}
/**
 * Display rows for the explorer pane — labels plus the seg-run channel
 * (same order/length as `rows`; each row carries 0..n paint runs).
 */
export declare function navigatorDisplay(rows: ExplorerRow[], snap: FleetSnapshot, width: number): {
    labels: string[];
    metas: Array<NavigatorMeta[] | null>;
};
/** compat view (tests/callers that only need labels) */
export declare function navigatorLabels(rows: ExplorerRow[], snap: FleetSnapshot, width: number): string[];
//# sourceMappingURL=navigator.d.ts.map