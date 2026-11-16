import type { NodeInventoryEntry } from "./types.js";
import type { LaunchAdmissionSnapshot } from "./launch-admission.js";
import type { ProviderLimitSnapshot } from "./provider-rate-limit.js";
import type { CliAgentBudgetSidecar } from "../adapters/cli-agent/cli-agent-runner-protocol.js";
import type { TaskBudgetConfig } from "../adapters/cli-agent/task-budget.js";
export type SeatResourceName = "provider_seats" | "launch_slot" | "wall_time" | "steps" | "tool_calls" | "tokens" | "cpu" | "memory";
export type SeatResourceBackend = "provider_semaphore" | "launch_admission" | "runner_sidecar" | "none";
export type SeatResourceScope = "provider_model" | "rig" | "seat" | "platform";
export type SeatResourceCoverage = "reported" | "not_reported";
export interface SeatResourceEntry {
    resource: SeatResourceName;
    scope: SeatResourceScope;
    /** null = no configured cap (unlimited) OR no measurement; `enforcedBy` says which. */
    limit: number | null;
    /** Live usage, or the most recent observation for per-turn dimensions. */
    current: number | null;
    peak: number | null;
    /** What the peak covers. Absent when peak is null. */
    peakScope?: "since_daemon_start" | "last_turn";
    enforcedBy: "config" | "not_enforced";
    backend: SeatResourceBackend;
    /** Why enforcement is absent or incomplete. Present iff it is not plain "config". */
    reason?: string;
    coverage?: SeatResourceCoverage;
    /** Present only when the runner recorded a budget breach on this dimension. */
    exhausted?: boolean;
    /** Live waiters behind this dimension's gate, when the source reports them. */
    queued?: number;
}
export interface SeatResourceRow {
    nodeId: string;
    rigId: string;
    rigName: string;
    seat: string;
    session: string | null;
    runtime: string | null;
    model: string | null;
    running: boolean;
    resources: SeatResourceEntry[];
}
/**
 * The optional data seams. Every field is optional so a test-built app (or an
 * older daemon) degrades to `snapshot_unavailable`/`not_enforced` rather than
 * inventing numbers.
 */
export interface SeatResourcesSources {
    launchAdmission?: {
        snapshot(): LaunchAdmissionSnapshot;
    };
    providerLimit?: {
        snapshot(): ProviderLimitSnapshot;
    };
    /** Fresh-read per-turn budget config; undefined = the master switch is off. */
    budgetLimits?: () => TaskBudgetConfig | undefined;
    /** The runner sidecar's budget block, or null when this seat has no runner sidecar. */
    readBudgetSidecar?: (input: {
        sessionName: string;
        runtime: string | null;
    }) => CliAgentBudgetSidecar | null;
}
export interface ProjectSeatResourcesInput {
    entries: readonly NodeInventoryEntry[];
    sources?: SeatResourcesSources;
    /** Test seam; defaults to the real platform. */
    platform?: NodeJS.Platform;
}
/** Build one row per registered seat (running or not), with every dimension the
 *  daemon can honestly answer. */
export declare function projectSeatResources(input: ProjectSeatResourcesInput): SeatResourceRow[];
//# sourceMappingURL=ps-resources.d.ts.map