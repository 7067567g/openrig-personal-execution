export type LaunchLane = "interactive" | "background";
export interface LaunchAdmissionConfig {
    enabled: boolean;
    /** Global cap on simultaneously admitted launches. 0 = unlimited. */
    maxConcurrent: number;
    /** Per-rig cap. 0 = unlimited. */
    maxPerRig: number;
    /** Slots background launches must leave free at each level. */
    reservedInteractive: number;
    /** How long an over-limit launch waits before admission_timeout. 0 = forever. */
    queueTimeoutSeconds: number;
}
export declare const DEFAULT_LAUNCH_ADMISSION_CONFIG: LaunchAdmissionConfig;
export interface LaunchAdmissionLease {
    ok: true;
    leaseId: string;
    rigId: string;
    lane: LaunchLane;
    /** "config" only when a numeric cap was actually enforcing. */
    enforcedBy: "config" | "not_enforced";
    /** Why enforcement is absent; present iff enforcedBy = not_enforced. */
    reason?: "disabled" | "no_limit";
    waitedMs: number;
}
export interface LaunchAdmissionTimeout {
    ok: false;
    code: "admission_timeout";
    message: string;
    rigId: string;
    lane: LaunchLane;
    waitedMs: number;
    /** 0-based position at the moment the waiter gave up. */
    queuePosition: number;
}
export type LaunchAdmissionResult = LaunchAdmissionLease | LaunchAdmissionTimeout;
export interface LaunchAdmissionConfigError {
    ok: false;
    code: "invalid_admission_config";
    message: string;
}
export interface LaunchAdmissionSnapshot {
    enabled: boolean;
    enforcedBy: "config" | "not_enforced";
    limits: {
        maxConcurrent: number;
        maxPerRig: number;
        reservedInteractive: number;
        /** Effective background caps after reserving interactive slots. */
        backgroundMaxConcurrent: number;
        backgroundMaxPerRig: number;
    };
    current: {
        global: number;
        byRig: Record<string, number>;
    };
    peak: {
        global: number;
        byRig: Record<string, number>;
        queued: number;
    };
    queued: {
        total: number;
        interactive: number;
        background: number;
    };
}
/** The seam NodeLauncher takes; the queue class below is the only implementation. */
export interface LaunchAdmission {
    acquire(input: {
        rigId: string;
        lane?: LaunchLane;
    }): Promise<LaunchAdmissionResult>;
    release(leaseId: string): void;
    snapshot(): LaunchAdmissionSnapshot;
}
export declare class LaunchAdmissionQueue implements LaunchAdmission {
    private readonly resolveConfig;
    private readonly now;
    private waiters;
    private readonly active;
    private seq;
    private leaseSeq;
    private peakGlobal;
    private peakQueued;
    private readonly peakByRig;
    constructor(resolveConfig?: () => LaunchAdmissionConfig, deps?: {
        now?: () => number;
    });
    private config;
    /** Number of active leases per rig (exposed for tests and future ps surfaces). */
    private activeForRig;
    private canAdmit;
    private leased;
    private unmetLimits;
    /**
     * Ask for a launch slot. Resolves `ok:true` when admitted (possibly after
     * waiting) or `ok:false` with `admission_timeout` when the queue deadline
     * expires. A disabled gate admits immediately and does not queue.
     */
    acquire(input: {
        rigId: string;
        lane?: LaunchLane;
    }): Promise<LaunchAdmissionResult>;
    /** Free a lease and hand the slot to the next waiter, if any. Idempotent. */
    release(leaseId: string): void;
    /** 0-based queue position, or null when not queued. */
    queuePosition(waiterId: string): number | null;
    private drain;
    private releaseDisabledWaiters;
    /** Read-only view for `rig ps --resources` (r5) and tests. */
    snapshot(): LaunchAdmissionSnapshot;
}
//# sourceMappingURL=launch-admission.d.ts.map