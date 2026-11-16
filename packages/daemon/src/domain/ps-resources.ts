// Per-seat resource enforcement projection for `rig ps --resources` (0.7.0 P1c).
//
// Why this module exists: the 0.7.0 P1 controls (launch admission, provider/model
// seat-start limit, per-turn budgets) each already expose a real snapshot. Before
// this projection the resource view showed host load only; operators could not see
// which seat was under which cap, or that a cap was NOT enforced.
//
// Honesty rules (the whole point of the surface):
//   - A number is reported only when the daemon actually measured it. A disabled
//     master switch yields `enforcedBy: "not_enforced"` + a reason, never 0/0.
//   - A budget dimension the runtime never emitted reads `not_reported`, never
//     "enforced". The shared-web DSH shim emits only session/status/final.
//   - CPU/memory are NOT budgeted in 0.7.0 (cgroup work is P3). They are listed
//     as `not_enforced` with a platform/implementation reason instead of being
//     hidden or reported as unlimited-and-fine.
//
// Pure and side-effect free: the route hands in the inventory and the optional
// snapshot sources; the startup wiring owns file reads (the runner sidecar).

import { platform as hostPlatform } from "node:os";
import type { NodeInventoryEntry } from "./types.js";
import { isEffectivelyRunning } from "./ps-projection.js";
import { providerForRuntime } from "./provider-rate-limit.js";
import type { LaunchAdmissionSnapshot } from "./launch-admission.js";
import type { ProviderLimitSnapshot } from "./provider-rate-limit.js";
import type { CliAgentBudgetSidecar } from "../adapters/cli-agent/cli-agent-runner-protocol.js";
import type { TaskBudgetConfig } from "../adapters/cli-agent/task-budget.js";

export type SeatResourceName =
  | "provider_seats"
  | "launch_slot"
  | "wall_time"
  | "steps"
  | "tool_calls"
  | "tokens"
  | "cpu"
  | "memory";

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
  launchAdmission?: { snapshot(): LaunchAdmissionSnapshot };
  providerLimit?: { snapshot(): ProviderLimitSnapshot };
  /** Fresh-read per-turn budget config; undefined = the master switch is off. */
  budgetLimits?: () => TaskBudgetConfig | undefined;
  /** The runner sidecar's budget block, or null when this seat has no runner sidecar. */
  readBudgetSidecar?: (input: { sessionName: string; runtime: string | null }) => CliAgentBudgetSidecar | null;
}

export interface ProjectSeatResourcesInput {
  entries: readonly NodeInventoryEntry[];
  sources?: SeatResourcesSources;
  /** Test seam; defaults to the real platform. */
  platform?: NodeJS.Platform;
}

function providerKey(provider: string, model: string | null | undefined): string {
  return `${provider}\u0000${model ?? ""}`;
}

function providerDisplay(provider: string, model: string | null | undefined): string {
  return `${provider}/${model || "default"}`;
}

/** The statuses `SessionRegistry.countLiveSeatsByRuntimesAndModel` counts as a
 *  live seat, i.e. the exact set the provider gate occupies. */
const PROVIDER_LIVE_STATUSES = new Set(["running", "idle", "unknown"]);

/** Whether this seat occupies a provider gate slot. Uses the stored status, not
 *  the identity-downranked view: the gate reads the registry row, so an
 *  identity-missing seat still holds its slot until the registry status changes.
 *  Counting only "running" here would show `current` below the gate's occupancy. */
function countsAsProviderLiveSeat(entry: NodeInventoryEntry): boolean {
  const status = entry.storedSessionStatus ?? entry.sessionStatus;
  return status !== null && status !== undefined && PROVIDER_LIVE_STATUSES.has(status);
}

/** Live seats for each provider/model, matching the limiter's live-count
 *  semantics (runtime family + exact model, null model distinct). */
function runningProviderCounts(entries: readonly NodeInventoryEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!countsAsProviderLiveSeat(entry)) continue;
    const key = providerKey(providerForRuntime(entry.runtime), entry.model);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function providerResource(
  entry: NodeInventoryEntry,
  snapshot: ProviderLimitSnapshot | undefined,
  counts: Map<string, number>,
): SeatResourceEntry {
  const provider = providerForRuntime(entry.runtime);
  const model = entry.model ?? "";
  const key = providerKey(provider, model);
  const current = counts.get(key) ?? 0;
  if (!snapshot) {
    return {
      resource: "provider_seats", scope: "provider_model", limit: null, current, peak: null,
      enforcedBy: "not_enforced", backend: "provider_semaphore", reason: "snapshot_unavailable",
    };
  }
  const cap = snapshot.limits.maxActiveSeats;
  const enforced = snapshot.enforcedBy === "config" && cap > 0;
  const seen = snapshot.byKey[providerDisplay(provider, model)];
  const reason = enforced ? undefined : snapshot.reason ?? "no_limit";
  return {
    resource: "provider_seats", scope: "provider_model",
    limit: cap > 0 ? cap : null,
    current,
    peak: enforced ? Math.max(seen?.peak ?? 0, current) : null,
    ...(enforced ? { peakScope: "since_daemon_start" as const } : {}),
    enforcedBy: enforced ? "config" : "not_enforced",
    backend: "provider_semaphore",
    ...(reason ? { reason } : {}),
    ...(enforced ? { queued: snapshot.queued.byKey[providerDisplay(provider, model)] ?? 0 } : {}),
  };
}

function launchResource(entry: NodeInventoryEntry, snapshot: LaunchAdmissionSnapshot | undefined): SeatResourceEntry {
  if (!snapshot) {
    return {
      resource: "launch_slot", scope: "rig", limit: null, current: null, peak: null,
      enforcedBy: "not_enforced", backend: "launch_admission", reason: "snapshot_unavailable",
    };
  }
  const cap = snapshot.limits.maxPerRig;
  const enforced = snapshot.enforcedBy === "config" && cap > 0;
  return {
    resource: "launch_slot", scope: "rig",
    limit: cap > 0 ? cap : null,
    current: snapshot.current.byRig[entry.rigId] ?? 0,
    peak: enforced ? (snapshot.peak.byRig[entry.rigId] ?? 0) : null,
    ...(enforced ? { peakScope: "since_daemon_start" as const } : {}),
    enforcedBy: enforced ? "config" : "not_enforced",
    backend: "launch_admission",
    ...(enforced ? { queued: snapshot.queued.total } : { reason: snapshot.enabled ? "no_limit" : "disabled" }),
  };
}

type BudgetDimension = "wall_time" | "steps" | "tool_calls" | "tokens";

const BUDGET_DIMENSIONS: ReadonlyArray<{ resource: BudgetDimension; limitKey: keyof TaskBudgetConfig }> = [
  { resource: "wall_time", limitKey: "maxWallTimeMs" },
  { resource: "steps", limitKey: "maxSteps" },
  { resource: "tool_calls", limitKey: "maxToolCalls" },
  { resource: "tokens", limitKey: "maxTokens" },
];

function observedFor(sidecar: CliAgentBudgetSidecar | null, dimension: BudgetDimension): number | null {
  if (!sidecar) return null;
  if (dimension === "wall_time") return sidecar.observed.wall_time_ms;
  return sidecar.observed[dimension];
}

function budgetResources(
  entry: NodeInventoryEntry,
  sources: SeatResourcesSources | undefined,
): SeatResourceEntry[] {
  const session = entry.canonicalSessionName;
  const limits = sources?.budgetLimits?.();
  const enabled = limits?.enabled === true;
  const sidecar = enabled && session && sources?.readBudgetSidecar
    ? sources.readBudgetSidecar({ sessionName: session, runtime: entry.runtime })
    : null;

  return BUDGET_DIMENSIONS.map(({ resource, limitKey }) => {
    const configured = enabled ? Number(limits?.[limitKey] ?? 0) : 0;
    const limit = configured > 0 ? configured : null;
    const observed = observedFor(sidecar, resource);
    // Coverage needs a sidecar to be evidence: with no sidecar there is no
    // measurement to call "reported", not even for wall time (the runner clock
    // lives in that sidecar). The reason below is `no_runner_sidecar`.
    const coverage: SeatResourceCoverage = !enabled || !sidecar
      ? "not_reported"
      : resource === "wall_time"
        ? "reported"
        : (sidecar.coverage[resource] as SeatResourceCoverage | undefined) ?? "not_reported";

    let reason: string | undefined;
    let enforced = enabled && configured > 0;
    if (!enabled) {
      reason = "disabled";
    } else if (configured <= 0) {
      reason = "no_limit";
    } else if (!sidecar) {
      // Budgets are on, but this seat has no runner sidecar (another runtime,
      // or a seat launched before the budget was enabled).
      reason = "no_runner_sidecar";
      enforced = false;
    } else if (coverage === "not_reported") {
      // Configured cap over a stream that never carried the evidence. Never
      // report this as enforced, and never read it as "0 used, therefore fine".
      reason = "not_reported_by_runtime";
      enforced = false;
    }

    const exhausted = sidecar?.exhausted?.dimension === resource ? true : undefined;
    return {
      resource, scope: "seat" as const,
      limit,
      current: observed,
      peak: observed,
      ...(observed !== null ? { peakScope: "last_turn" as const } : {}),
      enforcedBy: enforced ? "config" as const : "not_enforced" as const,
      backend: "runner_sidecar" as const,
      ...(reason ? { reason } : {}),
      coverage,
      ...(exhausted ? { exhausted } : {}),
    };
  });
}

function platformResources(platform: NodeJS.Platform): SeatResourceEntry[] {
  // 0.7.0 does not implement cgroup/systemd seat scopes (P3 in the plan).
  // Linux is the platform where that work would land; elsewhere the platform
  // has no equivalent. Both are `not_enforced`, with different reasons.
  const reason = platform === "linux" ? "cgroup_budget_not_implemented" : "platform_unsupported";
  return (["cpu", "memory"] as const).map((resource) => ({
    resource,
    scope: "platform" as const,
    limit: null, current: null, peak: null,
    enforcedBy: "not_enforced" as const,
    backend: "none" as const,
    reason,
  }));
}

/** Build one row per registered seat (running or not), with every dimension the
 *  daemon can honestly answer. */
export function projectSeatResources(input: ProjectSeatResourcesInput): SeatResourceRow[] {
  const platform = input.platform ?? hostPlatform();
  const providerSnapshot = input.sources?.providerLimit?.snapshot();
  const launchSnapshot = input.sources?.launchAdmission?.snapshot();
  const counts = runningProviderCounts(input.entries);

  return input.entries.map((entry) => ({
    nodeId: entry.nodeId,
    rigId: entry.rigId,
    rigName: entry.rigName,
    seat: entry.logicalId,
    session: entry.canonicalSessionName,
    runtime: entry.runtime,
    model: entry.model,
    running: isEffectivelyRunning(entry),
    resources: [
      providerResource(entry, providerSnapshot, counts),
      launchResource(entry, launchSnapshot),
      ...budgetResources(entry, input.sources),
      ...platformResources(platform),
    ],
  }));
}
