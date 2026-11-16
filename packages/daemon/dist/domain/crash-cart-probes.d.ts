import type { DaemonStateFile, HealthzProbeResult } from "./crash-cart-detect.js";
/** Classify a fetch REJECTION into a probe result — POSITIVE-FORM predicate (guard/orch rail):
 *  DOWN (refused) ONLY when (a) at least one terminal attempt exists AND (b) EVERY terminal attempt is
 *  recognizably ECONNREFUSED. Anything else — a timeout, an abort, another code, or a CODE-LESS /
 *  unrecognized failure — is ambiguous evidence and stays timeout/unverified (a timeout never promotes to
 *  a confirmed down; the cart never offers RESTORE on partial evidence). "No known-bad sibling" (a negated
 *  code-Set) erased a code-less sibling; "ALL known-good" (this positive form) closes the whole family. */
export declare function classifyProbeError(err: unknown): HealthzProbeResult;
export interface ProbeDeps {
    fetch: (url: string, init?: {
        signal?: AbortSignal;
    }) => Promise<Response>;
    timeoutMs?: number;
}
/** Probe `<url>` (a daemon /healthz): 2xx → answered; non-2xx (foreign occupant) → not-openrig; a
 *  rejection is classified (refused/timeout). Bounded by an abort timeout. */
export declare function probeHealthz(url: string, deps: ProbeDeps): Promise<HealthzProbeResult>;
/** True if `pid` is a live process. `process.kill(pid, 0)` throws ESRCH when absent, EPERM when it
 *  exists but we can't signal it (still alive). */
export declare function isProcessAlive(pid: number): boolean;
/** Read + parse `$OPENRIG_HOME/daemon.json` → the {pid,port,host} record, or undefined if absent or
 *  malformed (treated as "no state file"). */
export declare function readDaemonJson(openrigHome: string): DaemonStateFile | undefined;
//# sourceMappingURL=crash-cart-probes.d.ts.map