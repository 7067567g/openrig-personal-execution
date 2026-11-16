import type Database from "better-sqlite3";
import type { EventBus } from "../event-bus.js";
import type { RigRepository } from "../rig-repository.js";
export interface FleetRollupRow {
    rigName: string;
    /** Compact 5-state activity for a fleet view. */
    activityState: "active" | "idle" | "attention" | "blocked" | "degraded";
    lifecycleState: string | null;
    attentionReason: string | null;
    lastUpdate: string;
    /** v0.1.12-style label or "head" / "unknown". */
    cliVersionLabel: string;
    cliCapabilityStatus: "available" | "unavailable" | "unknown";
    /** True only when an observed version was independently confirmed outdated. */
    cliVersionOutdated: boolean;
    /** True if this rig was observed missing one or more required list fields. */
    cliDriftDetected: boolean;
}
export interface FleetRollup {
    rows: FleetRollupRow[];
    staleCliCount: number;
    /** Rigs whose CLI field support has not been observed. */
    unknownCliCount: number;
    /** Fields known to be missing across the observed rigs (de-duplicated). */
    degradedFields: string[];
    /** Source of fleet activity when it is projected without reading the CLI. */
    sourceFallback: string | null;
}
export interface CliCapabilityObservation {
    cliVersionLabel: string;
    /** Null means unobserved; an empty array means all required fields were supported. */
    unsupportedFields: string[] | null;
    /** Independent version evidence, never inferred from missing fields. */
    versionOutdated?: boolean;
}
interface CliCapabilityDeps {
    db: Database.Database;
    eventBus: EventBus;
    rigRepo: RigRepository;
    /**
     * Optional observation of a rig's CLI version and supported list fields.
     * Without an observation, both remain unknown.
     */
    probeRig?: (rigName: string) => Promise<CliCapabilityObservation>;
    /** Override clock for tests. */
    now?: () => Date;
}
/**
 * Fields expected from the node list. recoveryGuidance belongs to node
 * detail; its absence from `rig ps --nodes --fields` is not incompatibility.
 */
export declare const MISSION_CONTROL_DESIRED_FIELDS: readonly ["agentActivity"];
/**
 * Adapt explicit local CLI observations. The daemon-internal projection
 * does not observe a CLI by itself, so omitted inputs remain unknown.
 * Do not substitute the daemon's package version or a mirrored CLI allow-list.
 */
export declare function makeLocalCliCapabilityProbe(opts?: {
    versionLabel?: string;
    knownNodeFields?: ReadonlySet<string>;
    versionOutdated?: boolean;
}): (rigName: string) => Promise<CliCapabilityObservation>;
export declare class MissionControlFleetCliCapability {
    private readonly db;
    private readonly eventBus;
    private readonly rigRepo;
    private readonly probeRig;
    private readonly now;
    /** Per-(rig, field) once-per-session log set. Cleared on daemon restart. */
    private readonly loggedDriftKeys;
    constructor(deps: CliCapabilityDeps);
    rollupFleet(): Promise<FleetRollup>;
    /**
     * Per-(rig, field) once-per-session-per-rig log per PRD sub-clause 3.
     * Daemon restart clears the set so logging fires again on first
     * post-restart observation.
     */
    private maybeLogDriftOnce;
    /**
     * Summarize a rig's queue state for the fleet view. Synthesized
     * from PL-004 Phase A queue_items via a single SQL aggregation:
     *   - active: any in-progress qitem
     *   - blocked: any blocked qitem (no in-progress)
     *   - attention: only pending qitems older than 1h
     *   - idle: no active queue activity
     *   - degraded: any failed/denied/canceled qitem in last 24h
     */
    private summarizeRigQueue;
    /** Test/observability helper: clear the once-per-session log set. */
    resetDriftLogForTest(): void;
}
export {};
//# sourceMappingURL=mission-control-fleet-cli-capability.d.ts.map