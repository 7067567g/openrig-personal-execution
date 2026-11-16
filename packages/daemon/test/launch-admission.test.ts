import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LAUNCH_ADMISSION_CONFIG,
  LaunchAdmissionQueue,
  type LaunchAdmissionConfig,
} from "../src/domain/launch-admission.js";

function config(patch: Partial<LaunchAdmissionConfig> = {}): LaunchAdmissionConfig {
  return {
    enabled: true,
    maxConcurrent: 2,
    maxPerRig: 0,
    reservedInteractive: 0,
    queueTimeoutSeconds: 300,
    ...patch,
  };
}

async function pending(p: Promise<unknown>): Promise<boolean> {
  let settled = false;
  p.then(() => { settled = true; }, () => { settled = true; });
  await Promise.resolve();
  await Promise.resolve();
  return !settled;
}

describe("LaunchAdmissionQueue", () => {
  it("is disabled by default and admits immediately without counters or enforcement", async () => {
    const queue = new LaunchAdmissionQueue();
    const first = await queue.acquire({ rigId: "r1" });
    const second = await queue.acquire({ rigId: "r2", lane: "interactive" });
    expect(first).toMatchObject({ ok: true, enforcedBy: "not_enforced", reason: "disabled", waitedMs: 0 });
    expect(second).toMatchObject({ ok: true, enforcedBy: "not_enforced", reason: "disabled" });
    const snapshot = queue.snapshot();
    expect(snapshot).toMatchObject({ enabled: false, enforcedBy: "not_enforced" });
    expect(snapshot.current.global).toBe(0);
    expect(snapshot.queued.total).toBe(0);
    expect(DEFAULT_LAUNCH_ADMISSION_CONFIG.enabled).toBe(false);
  });

  it("enabled with no numeric cap admits immediately and reports no_limit", async () => {
    const queue = new LaunchAdmissionQueue(() => config({ maxConcurrent: 0, maxPerRig: 0 }));
    const lease = await queue.acquire({ rigId: "r1" });
    expect(lease).toMatchObject({ ok: true, enforcedBy: "not_enforced", reason: "no_limit" });
    queue.release((lease as { leaseId: string }).leaseId);
    expect(queue.snapshot().current.global).toBe(0);
  });

  it("queues over the global cap and admits FIFO after a release", async () => {
    const queue = new LaunchAdmissionQueue(() => config({ maxConcurrent: 2 }));
    const a = await queue.acquire({ rigId: "r1" });
    const b = await queue.acquire({ rigId: "r2" });
    expect(a.ok && b.ok).toBe(true);

    const queued = queue.acquire({ rigId: "r3" });
    expect(await pending(queued)).toBe(true);
    expect(queue.snapshot()).toMatchObject({
      current: { global: 2 },
      queued: { total: 1, background: 1 },
      enforcedBy: "config",
    });

    queue.release((a as { leaseId: string }).leaseId);
    const admitted = await queued;
    expect(admitted).toMatchObject({ ok: true, rigId: "r3", enforcedBy: "config" });
    expect((admitted as { waitedMs: number }).waitedMs).toBeGreaterThanOrEqual(0);
    expect(queue.snapshot().current.global).toBe(2);
  });

  it("releases queued waiters as not_enforced when the switch is turned off while they wait", async () => {
    let cfg = config({ maxConcurrent: 1 });
    const queue = new LaunchAdmissionQueue(() => cfg);
    const active = await queue.acquire({ rigId: "r1" });
    const queued = queue.acquire({ rigId: "r2" });
    expect(await pending(queued)).toBe(true);

    cfg = config({ enabled: false, maxConcurrent: 1 });
    queue.release((active as { leaseId: string }).leaseId);
    expect(await queued).toMatchObject({
      ok: true, rigId: "r2", enforcedBy: "not_enforced", reason: "disabled",
    });
    expect(queue.snapshot().current.global).toBe(0);
  });

  it("enforces the per-rig cap independently of the global cap", async () => {
    const queue = new LaunchAdmissionQueue(() => config({ maxConcurrent: 10, maxPerRig: 1 }));
    const a = await queue.acquire({ rigId: "r1" });
    const otherRig = await queue.acquire({ rigId: "r2" });
    expect(otherRig.ok).toBe(true);
    const blocked = queue.acquire({ rigId: "r1" });
    expect(await pending(blocked)).toBe(true);
    expect(queue.snapshot().current.byRig).toEqual({ r1: 1, r2: 1 });
    queue.release((a as { leaseId: string }).leaseId);
    expect(await blocked).toMatchObject({ ok: true, rigId: "r1" });
  });

  it("reserves a slot for interactive launches: background cannot consume it", async () => {
    // global 2, one reserved: background may only have one active launch.
    const queue = new LaunchAdmissionQueue(() => config({ maxConcurrent: 2, reservedInteractive: 1 }));
    const background = await queue.acquire({ rigId: "r1" });
    const blockedBackground = queue.acquire({ rigId: "r1" });
    expect(await pending(blockedBackground)).toBe(true);

    // The interactive launch takes the reserved slot immediately.
    const interactive = await queue.acquire({ rigId: "r1", lane: "interactive" });
    expect(interactive).toMatchObject({ ok: true, lane: "interactive", enforcedBy: "config" });
    expect(queue.snapshot()).toMatchObject({
      current: { global: 2 },
      limits: { backgroundMaxConcurrent: 1 },
      queued: { total: 1, background: 1 },
    });

    // Freeing the interactive slot does NOT let a second background in while
    // the first background lease still occupies the single background slot.
    queue.release((interactive as { leaseId: string }).leaseId);
    await Promise.resolve();
    expect(await pending(blockedBackground)).toBe(true);

    queue.release((background as { leaseId: string }).leaseId);
    expect(await blockedBackground).toMatchObject({ ok: true, rigId: "r1" });
  });

  it("prefers an interactive waiter over an earlier background waiter", async () => {
    const queue = new LaunchAdmissionQueue(() => config({ maxConcurrent: 1, reservedInteractive: 0 }));
    const active = await queue.acquire({ rigId: "r1" });
    const background = queue.acquire({ rigId: "r2" });
    const interactive = queue.acquire({ rigId: "r3", lane: "interactive" });
    expect(await pending(background)).toBe(true);
    expect(await pending(interactive)).toBe(true);

    queue.release((active as { leaseId: string }).leaseId);
    expect(await interactive).toMatchObject({ ok: true, rigId: "r3", lane: "interactive" });
    expect(await pending(background)).toBe(true);

    queue.release((await interactive as { leaseId: string }).leaseId);
    expect(await background).toMatchObject({ ok: true, rigId: "r2" });
  });

  it("times out a queued launch without starting it and reports its position", async () => {
    vi.useFakeTimers();
    try {
      const queue = new LaunchAdmissionQueue(() => config({ maxConcurrent: 1, queueTimeoutSeconds: 2 }));
      const active = await queue.acquire({ rigId: "r1" });
      const queued = queue.acquire({ rigId: "r2" });
      expect(queue.snapshot().queued.total).toBe(1);
      await vi.advanceTimersByTimeAsync(2000);
      const timedOut = await queued;
      expect(timedOut).toMatchObject({
        ok: false,
        code: "admission_timeout",
        rigId: "r2",
        queuePosition: 0,
      });
      expect((timedOut as { waitedMs: number }).waitedMs).toBeGreaterThanOrEqual(2000);
      expect(queue.snapshot().queued.total).toBe(0);
      // The slot holder is untouched and can release normally.
      queue.release((active as { leaseId: string }).leaseId);
      expect(queue.snapshot().current.global).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tracks peak concurrency and peak queue depth in the snapshot", async () => {
    const queue = new LaunchAdmissionQueue(() => config({ maxConcurrent: 1, reservedInteractive: 0 }));
    const a = await queue.acquire({ rigId: "r1" });
    const b = queue.acquire({ rigId: "r1" });
    const c = queue.acquire({ rigId: "r2" });
    expect(await pending(b)).toBe(true);
    expect(await pending(c)).toBe(true);
    let snapshot = queue.snapshot();
    expect(snapshot.peak.queued).toBe(2);
    queue.release((a as { leaseId: string }).leaseId);
    await b;
    queue.release((await b as { leaseId: string }).leaseId);
    await c;
    snapshot = queue.snapshot();
    expect(snapshot.peak.global).toBe(1);
    expect(snapshot.peak.byRig).toEqual({ r1: 1, r2: 1 });
  });

  it("release is idempotent and does not invent capacity", async () => {
    const queue = new LaunchAdmissionQueue(() => config({ maxConcurrent: 1 }));
    const lease = await queue.acquire({ rigId: "r1" });
    queue.release((lease as { leaseId: string }).leaseId);
    queue.release((lease as { leaseId: string }).leaseId);
    queue.release("never-existed");
    expect(queue.snapshot().current.global).toBe(0);
  });
});
