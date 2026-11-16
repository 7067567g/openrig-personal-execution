// Seat launch admission — the daemon-side gate for "start this seat now".
//
// Why launches, not "turns": a turn happens inside the pane-hosted
// cli-agent-runner child process; the daemon has no turn boundary it could
// hold. What the daemon actually starts is a seat (tmux session + harness),
// so an over-limit *launch* waits in a FIFO queue instead of stampeding the
// host. Per-turn limits live in the runner (task-budget.ts).
//
// Default posture: DISABLED. `enabled=false` admits every launch immediately
// and reports `enforced_by: "not_enforced"` — no queue, no counters, no
// behaviour change for existing rigs.
//
// Reserved interactive slots: background launches may occupy at most
// `limit - reservedInteractive` slots at each level (global and per-rig), so
// an operator-initiated launch never waits behind a batch boot. Interactive
// launches may use the whole limit. Reserved > limit floors the background cap
// at zero; it does not make the limit negative.
//
// The queue is in-memory and intentionally not durable: a daemon restart
// drops waiters (the caller's launch request fails/disconnects) rather than
// silently resurrecting stale launches. This is stated in the reference doc and
// the round verdict, not implied.

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

export const DEFAULT_LAUNCH_ADMISSION_CONFIG: LaunchAdmissionConfig = {
  enabled: false,
  maxConcurrent: 4,
  maxPerRig: 2,
  reservedInteractive: 1,
  queueTimeoutSeconds: 300,
};

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

interface Waiter {
  id: string;
  rigId: string;
  lane: LaunchLane;
  seq: number;
  enqueuedAt: number;
  settled: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  resolve: (result: LaunchAdmissionResult) => void;
}

interface ActiveLease {
  leaseId: string;
  rigId: string;
  lane: LaunchLane;
  enforced: boolean;
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
  current: { global: number; byRig: Record<string, number> };
  peak: { global: number; byRig: Record<string, number>; queued: number };
  queued: { total: number; interactive: number; background: number };
}

/** The seam NodeLauncher takes; the queue class below is the only implementation. */
export interface LaunchAdmission {
  acquire(input: { rigId: string; lane?: LaunchLane }): Promise<LaunchAdmissionResult>;
  release(leaseId: string): void;
  snapshot(): LaunchAdmissionSnapshot;
}

function normalizeConfig(raw: LaunchAdmissionConfig): LaunchAdmissionConfig {
  const int = (value: number, fallback: number): number =>
    Number.isFinite(value) && Number.isInteger(value) && value >= 0 ? value : fallback;
  return {
    enabled: raw.enabled === true,
    maxConcurrent: int(raw.maxConcurrent, 0),
    maxPerRig: int(raw.maxPerRig, 0),
    reservedInteractive: int(raw.reservedInteractive, 0),
    queueTimeoutSeconds: int(raw.queueTimeoutSeconds, 0),
  };
}

function effectiveCap(limit: number): number {
  return limit > 0 ? limit : Number.POSITIVE_INFINITY;
}

function backgroundCap(limit: number, reserved: number): number {
  if (limit <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, limit - reserved);
}

export class LaunchAdmissionQueue implements LaunchAdmission {
  private readonly resolveConfig: () => LaunchAdmissionConfig;
  private readonly now: () => number;
  private waiters: Waiter[] = [];
  private readonly active = new Map<string, ActiveLease>();
  private seq = 0;
  private leaseSeq = 0;
  private peakGlobal = 0;
  private peakQueued = 0;
  private readonly peakByRig = new Map<string, number>();

  constructor(
    resolveConfig: () => LaunchAdmissionConfig = () => DEFAULT_LAUNCH_ADMISSION_CONFIG,
    deps: { now?: () => number } = {},
  ) {
    this.resolveConfig = resolveConfig;
    this.now = deps.now ?? (() => Date.now());
  }

  private config(): LaunchAdmissionConfig {
    return normalizeConfig(this.resolveConfig());
  }

  /** Number of active leases per rig (exposed for tests and future ps surfaces). */
  private activeForRig(rigId: string): number {
    let count = 0;
    for (const lease of this.active.values()) if (lease.rigId === rigId) count += 1;
    return count;
  }

  private canAdmit(rigId: string, lane: LaunchLane, cfg: LaunchAdmissionConfig): boolean {
    const globalLimit = effectiveCap(cfg.maxConcurrent);
    const rigLimit = effectiveCap(cfg.maxPerRig);
    const globalCap = lane === "background"
      ? backgroundCap(cfg.maxConcurrent, cfg.reservedInteractive)
      : globalLimit;
    const rigCap = lane === "background"
      ? backgroundCap(cfg.maxPerRig, cfg.reservedInteractive)
      : rigLimit;
    return this.active.size < globalCap && this.activeForRig(rigId) < rigCap;
  }

  private leased(rigId: string, lane: LaunchLane, enforced: boolean, waitedMs: number, reason?: "disabled" | "no_limit"): LaunchAdmissionLease {
    this.leaseSeq += 1;
    const leaseId = `launch-${this.leaseSeq}`;
    this.active.set(leaseId, { leaseId, rigId, lane, enforced });
    const rigActive = this.activeForRig(rigId);
    if (this.active.size > this.peakGlobal) this.peakGlobal = this.active.size;
    const priorPeak = this.peakByRig.get(rigId) ?? 0;
    if (rigActive > priorPeak) this.peakByRig.set(rigId, rigActive);
    return {
      ok: true,
      leaseId,
      rigId,
      lane,
      enforcedBy: enforced ? "config" : "not_enforced",
      ...(enforced ? {} : { reason: reason ?? "disabled" }),
      waitedMs,
    };
  }

  private unmetLimits(cfg: LaunchAdmissionConfig): boolean {
    return cfg.maxConcurrent > 0 || cfg.maxPerRig > 0;
  }

  /**
   * Ask for a launch slot. Resolves `ok:true` when admitted (possibly after
   * waiting) or `ok:false` with `admission_timeout` when the queue deadline
   * expires. A disabled gate admits immediately and does not queue.
   */
  acquire(input: { rigId: string; lane?: LaunchLane }): Promise<LaunchAdmissionResult> {
    const lane = input.lane ?? "background";
    const rigId = input.rigId;
    const cfg = this.config();
    const startedAt = this.now();

    if (!cfg.enabled) {
      // No counters, no queue: the historical "start immediately" path.
      this.leaseSeq += 1;
      return Promise.resolve({
        ok: true,
        leaseId: `launch-disabled-${this.leaseSeq}`,
        rigId,
        lane,
        enforcedBy: "not_enforced",
        reason: "disabled",
        waitedMs: 0,
      });
    }
    if (!this.unmetLimits(cfg)) {
      return Promise.resolve(this.leased(rigId, lane, false, 0, "no_limit"));
    }
    if (this.canAdmit(rigId, lane, cfg)) {
      return Promise.resolve(this.leased(rigId, lane, true, 0));
    }

    const waiterId = `wait-${this.seq + 1}`;
    return new Promise<LaunchAdmissionResult>((resolve) => {
      const waiter: Waiter = {
        id: waiterId,
        rigId,
        lane,
        seq: this.seq++,
        enqueuedAt: startedAt,
        settled: false,
        timer: null,
        resolve,
      };
      this.waiters.push(waiter);
      if (this.waiters.length > this.peakQueued) this.peakQueued = this.waiters.length;
      if (cfg.queueTimeoutSeconds > 0) {
        waiter.timer = setTimeout(() => {
          if (waiter.settled) return;
          waiter.settled = true;
          const position = this.waiters.findIndex((candidate) => candidate.id === waiter.id);
          this.waiters = this.waiters.filter((candidate) => candidate.id !== waiter.id);
          resolve({
            ok: false,
            code: "admission_timeout",
            message: `Launch of ${rigId} (${lane}) waited ${Math.round((this.now() - waiter.enqueuedAt) / 1000)}s for an admission slot and timed out; it was NOT started.`,
            rigId,
            lane,
            waitedMs: Math.max(0, this.now() - waiter.enqueuedAt),
            queuePosition: Math.max(0, position),
          });
        }, cfg.queueTimeoutSeconds * 1000);
        // Do not keep a short-lived CLI/HTTP process alive only for this timer.
        (waiter.timer as { unref?: () => void }).unref?.();
      }
    });
  }

  /** Free a lease and hand the slot to the next waiter, if any. Idempotent. */
  release(leaseId: string): void {
    const lease = this.active.get(leaseId);
    if (!lease) return;
    this.active.delete(leaseId);
    this.drain();
    // `lease` is read only for clarity in debugging; keep the reference live
    // for future peak-by-lane accounting without changing the signature.
    void lease;
  }

  /** 0-based queue position, or null when not queued. */
  queuePosition(waiterId: string): number | null {
    const index = this.waiters.findIndex((waiter) => waiter.id === waiterId);
    return index < 0 ? null : index;
  }

  private drain(): void {
    const cfg = this.config();
    if (!cfg.enabled) {
      // The switch was turned off while calls were queued. Admit them now with
      // `not_enforced` instead of leaving them pending until their deadline (or
      // forever when queueTimeoutSeconds=0). Same posture as ProviderRateLimiter.
      this.releaseDisabledWaiters();
      return;
    }
    // Interactive waiters strictly precede background ones; FIFO within a lane.
    for (;;) {
      const ordered = [...this.waiters].sort((a, b) => {
        if (a.lane !== b.lane) return a.lane === "interactive" ? -1 : 1;
        return a.seq - b.seq;
      });
      const next = ordered.find((waiter) => !waiter.settled && this.canAdmit(waiter.rigId, waiter.lane, cfg));
      if (!next) return;
      next.settled = true;
      this.waiters = this.waiters.filter((waiter) => waiter.id !== next.id);
      if (next.timer) clearTimeout(next.timer);
      next.resolve(this.leased(next.rigId, next.lane, true, Math.max(0, this.now() - next.enqueuedAt)));
    }
  }

  private releaseDisabledWaiters(): void {
    const waiters = this.waiters;
    this.waiters = [];
    for (const waiter of waiters) {
      if (waiter.settled) continue;
      waiter.settled = true;
      if (waiter.timer) clearTimeout(waiter.timer);
      this.leaseSeq += 1;
      waiter.resolve({
        ok: true,
        leaseId: `launch-disabled-${this.leaseSeq}`,
        rigId: waiter.rigId,
        lane: waiter.lane,
        enforcedBy: "not_enforced",
        reason: "disabled",
        waitedMs: Math.max(0, this.now() - waiter.enqueuedAt),
      });
    }
  }

  /** Read-only view for `rig ps --resources` (r5) and tests. */
  snapshot(): LaunchAdmissionSnapshot {
    const cfg = this.config();
    const byRig: Record<string, number> = {};
    for (const lease of this.active.values()) {
      byRig[lease.rigId] = (byRig[lease.rigId] ?? 0) + 1;
    }
    const queuedInteractive = this.waiters.filter((waiter) => waiter.lane === "interactive").length;
    const peakByRig: Record<string, number> = {};
    for (const [rigId, peak] of this.peakByRig.entries()) peakByRig[rigId] = peak;
    const enforced = cfg.enabled && this.unmetLimits(cfg);
    return {
      enabled: cfg.enabled,
      enforcedBy: enforced ? "config" : "not_enforced",
      limits: {
        maxConcurrent: cfg.maxConcurrent,
        maxPerRig: cfg.maxPerRig,
        reservedInteractive: cfg.reservedInteractive,
        backgroundMaxConcurrent: backgroundCap(cfg.maxConcurrent, cfg.reservedInteractive),
        backgroundMaxPerRig: backgroundCap(cfg.maxPerRig, cfg.reservedInteractive),
      },
      current: { global: this.active.size, byRig },
      peak: { global: this.peakGlobal, byRig: peakByRig, queued: this.peakQueued },
      queued: {
        total: this.waiters.length,
        interactive: queuedInteractive,
        background: this.waiters.length - queuedInteractive,
      },
    };
  }
}
