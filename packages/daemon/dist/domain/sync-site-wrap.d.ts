import type { SlowOperationInstrumentation } from "./slow-op-recorder.js";
export declare function configureSyncSiteRecorder(next: SlowOperationInstrumentation | undefined): void;
export declare function runSyncSite<T>(site: string, fn: () => T): T;
/**
 * Async twin of runSyncSite: instruments a NON-blocking site through the
 * recorder's async `runStage` seam (falls back to a bare call when no recorder
 * is configured). Use this for sites whose work must NOT block the event loop
 * (e.g. process-table sampling via async execFile) — a synchronous `runSyncSite`
 * wrapping an `execFileSync` freezes the loop for the whole spawn, which is the
 * daemon-degradation defect this replaces.
 */
export declare function runAsyncSite<T>(site: string, fn: () => Promise<T>): Promise<T>;
//# sourceMappingURL=sync-site-wrap.d.ts.map