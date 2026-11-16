/** The honest-unknown text for the two unrecoverable header slots (PM ruling). */
export declare const NO_SHUTDOWN_RECORD = "unavailable \u2014 no shutdown record";
export interface CrashCartHeaderVM {
    /** Last activity time (HH:MM) derived from the newest durable write; "unknown" if none. */
    lastSeen: string;
    /** Always the honest-unknown text — prior uptime is not persisted. */
    uptimeText: string;
    /** Always the honest-unknown text — stop reason is not persisted. */
    reasonText: string;
}
export interface CrashCartRigVM {
    name: string;
    seatCount: number;
    lastActive: string;
    resumableCount: number;
}
export interface CrashCartStoppedVM {
    session: string;
    summary: string;
    time: string;
}
export interface CrashCartModel {
    /** recovery = evidence of prior life (rigs and/or last activity) → the crash cockpit.
     *  first-run = DOWN + no DB (no rigs, no prior activity) → onboarding framing, never a crash story. */
    mode: "recovery" | "first-run";
    header: CrashCartHeaderVM;
    foundOnHost: CrashCartRigVM[];
    /** In-progress work at crash time; empty ⇒ the renderer shows only the idle-clean line. */
    whereWorkStopped: CrashCartStoppedVM[];
}
/** The subset of the C2 discovery the view consumes (structurally the daemon's CrashCartDiscovery;
 *  kept local so the pure view has no cross-package import — the integration passes the real one). */
export interface CrashCartDiscoveryInput {
    header: {
        lastActivityAt: string | null;
    };
    foundOnHost: Array<{
        rigName: string;
        seatCount: number;
        resumableCount: number;
        lastActiveAt: string | null;
    }>;
    whereWorkStopped: Array<{
        destinationSession: string;
        summary: string | null;
        tsUpdated: string;
    }>;
}
/** Extract HH:MM from an ISO-Z or SQLite `datetime('now')` timestamp (format-agnostic, no timezone
 *  math — the crash-cart shows wall times as recorded); null/unparseable ⇒ "unknown". */
export declare function hhmm(ts: string | null): string;
/** Adapt the C2 daemon-down discovery into the crash-cart view model. */
export declare function buildCrashCartModel(discovery: CrashCartDiscoveryInput): CrashCartModel;
/** Static fixture reproducing the approved mock's data (with the PM honest-unknown header). Used by
 *  the demo screen + the strip-invariant test. */
export declare function demoCrashCartModel(): CrashCartModel;
//# sourceMappingURL=crash-cart-model.d.ts.map