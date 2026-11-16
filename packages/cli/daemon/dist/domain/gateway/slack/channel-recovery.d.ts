import { type FetchImpl } from "./slack-api.js";
import { type InboundRouter } from "./inbound.js";
import { ChannelCoverageStore, type ChannelCoverage } from "./state-store.js";
interface RecoveryOptions {
    channel: string | null;
    token: string | null;
    stateDir: string;
    router: InboundRouter;
    fetchImpl?: FetchImpl;
    store?: ChannelCoverageStore;
    now?: () => number;
}
/** One owner across socket generations. Stop fences admission and checkpoint writes;
 * already admitted I/O remains owned until it settles (no timeout/unlock race). */
export declare class ChannelRecovery {
    private readonly opts;
    private readonly store;
    private readonly now;
    private coverage?;
    private pass?;
    private stopped;
    private state;
    private reason;
    private lastScanAt;
    private accepted;
    private deadLettered;
    constructor(opts: RecoveryOptions);
    initialize(): void;
    status(): {
        state: string;
        reason: string | undefined;
        channel: string | null;
        lastScanAt: string | undefined;
        coverage: ChannelCoverage | null;
        acceptedThisProcess: number;
        deadLetteredThisProcess: number;
        limits: string[];
    };
    stop(): void;
    run(): Promise<void>;
    private save;
    private scan;
}
export {};
//# sourceMappingURL=channel-recovery.d.ts.map