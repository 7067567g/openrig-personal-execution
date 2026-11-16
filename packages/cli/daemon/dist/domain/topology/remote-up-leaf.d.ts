import type { HttpHostEntry } from "../hosts/hosts-registry-reader.js";
export interface RemoteUpLeafDeps {
    /** Injected for tests; defaults to global fetch. */
    fetchImpl?: typeof fetch;
    env?: Record<string, string | undefined>;
    readFile?: (path: string) => string;
    /** Bounded remote-up deadline (rev1-r2 R2-B1). Defaults to the
     *  long-running rig-up budget — remote bootstrap legitimately runs
     *  minutes, but never forever. Passed EXPLICITLY to the shared core
     *  (the deadline class is this call-site's decision, per the arch
     *  required-argument sharpening). */
    timeoutMs?: number;
}
/** Matches the CLI's LONG_RUNNING_UP_TIMEOUT_MS for standalone remote ups. */
export declare const REMOTE_UP_TIMEOUT_MS = 120000;
export interface RemoteUpBody {
    sourceRef: string;
    autoApprove?: boolean;
    nonInterruptive?: boolean;
}
/** POST the placed entry to the remote daemon's shipped /api/up. Returns the
 *  launcher's normalized {ok, error?} shape; the remote daemon's own error
 *  text rides through verbatim where available. Never hangs: the shared
 *  core holds ONE deadline through request AND body parse (the G-R2B1-1
 *  class is structurally closed there). */
export declare function remoteUpLeaf(body: RemoteUpBody, host: HttpHostEntry, deps?: RemoteUpLeafDeps): Promise<{
    ok: boolean;
    error?: string;
}>;
//# sourceMappingURL=remote-up-leaf.d.ts.map