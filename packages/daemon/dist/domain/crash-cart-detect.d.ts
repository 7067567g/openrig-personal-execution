export type DaemonState = "up" | "down" | "unverified";
/** The /healthz probe outcome — distinguishes a REFUSED connection (strong down) from a TIMEOUT
 *  (unverified) from a foreign occupant (unverified). */
export type HealthzProbeResult = "answered" | "refused" | "timeout" | "not-openrig";
/** Verbatim evidence rendered on the UNVERIFIED screen (never a crash story — the honest "we cannot
 *  confirm the daemon is down" record). Assembled by the caller from the pid check + last probe. */
export interface DaemonUnverifiedEvidence {
    pidState: string;
    probeResult: string;
    failedSignal: string;
}
/** Minimal daemon.json shape the classifier needs. */
export interface DaemonStateFile {
    pid: number;
    port: number;
    host?: string;
}
export interface ClassifyDaemonDeps {
    openrigHome: string;
    readDaemonJson: (openrigHome: string) => DaemonStateFile | undefined;
    isProcessAlive: (pid: number) => boolean;
    probeHealthz: (url: string) => Promise<HealthzProbeResult>;
    openrigUrl?: string;
}
/**
 * SINGLE-SHOT classification (the per-probe primitive; the bounded retry is resolveDaemonState).
 * DOWN only on positive evidence (pid dead/absent AND refused); UP on answered; else UNVERIFIED.
 */
export declare function classifyDaemonState(deps: ClassifyDaemonDeps): Promise<DaemonState>;
export interface ResolveDaemonDeps extends ClassifyDaemonDeps {
    /** Injected delay between probes (deterministic in tests). */
    sleep: (ms: number) => Promise<void>;
    /** Max probes (small/bounded, sub-2s feel — default 3). */
    maxProbes?: number;
    /** Delay between probes in ms (default 400 → ~2 gaps under 2s at 3 probes). */
    retryDelayMs?: number;
}
/**
 * Bounded-retry resolution. UP (answered) and DOWN (refused + pid-dead) are DECISIVE — returned on the
 * first probe that yields them, no retry. UNVERIFIED (timeout/wedged/foreign) triggers a bounded retry;
 * if it never resolves to UP or DOWN within maxProbes, the verdict is UNVERIFIED. A timeout NEVER
 * promotes to DOWN at any retry count (the false-negative rail).
 */
export declare function resolveDaemonState(deps: ResolveDaemonDeps): Promise<DaemonState>;
//# sourceMappingURL=crash-cart-detect.d.ts.map