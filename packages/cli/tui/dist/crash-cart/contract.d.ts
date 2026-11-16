export type DaemonState = "up" | "down" | "unverified";
/** Verbatim evidence for the UNVERIFIED screen (cannot-confirm-down). */
export interface DaemonUnverifiedEvidence {
    pidState: string;
    probeResult: string;
    failedSignal: string;
}
//# sourceMappingURL=contract.d.ts.map