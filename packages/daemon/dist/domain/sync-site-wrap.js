let recorder;
export function configureSyncSiteRecorder(next) {
    recorder = next;
}
export function runSyncSite(site, fn) {
    return recorder?.runSync ? recorder.runSync(site, fn) : fn();
}
/**
 * Async twin of runSyncSite: instruments a NON-blocking site through the
 * recorder's async `runStage` seam (falls back to a bare call when no recorder
 * is configured). Use this for sites whose work must NOT block the event loop
 * (e.g. process-table sampling via async execFile) — a synchronous `runSyncSite`
 * wrapping an `execFileSync` freezes the loop for the whole spawn, which is the
 * daemon-degradation defect this replaces.
 */
export async function runAsyncSite(site, fn) {
    return recorder?.runStage ? recorder.runStage(site, fn) : fn();
}
//# sourceMappingURL=sync-site-wrap.js.map