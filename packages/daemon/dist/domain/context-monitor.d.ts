import type Database from "better-sqlite3";
import type { ClaudeCompactionEnforcer } from "./claude-compaction-enforcer.js";
import type { ContextUsageStore } from "./context-usage-store.js";
import { type NodeBinding, type ReadinessResult } from "./runtime-adapter.js";
import type { UsageSamplesStore, ProviderWindowSampleInput } from "./usage-samples-store.js";
/** Default polling interval: 30 seconds. */
export declare const DEFAULT_POLL_INTERVAL_MS = 30000;
interface ClaudeContextProvisioner {
    ensureContextCollector(binding: {
        cwd?: string | null;
        tmuxSession?: string | null;
    }): void;
    checkReady?(binding: NodeBinding): Promise<ReadinessResult>;
}
interface RuntimeReadinessChecker {
    checkReady?(binding: NodeBinding): Promise<ReadinessResult>;
}
/**
 * Polls known managed runtime context sources and persists the latest
 * normalized telemetry. Scheduler-only: no queries, no response shaping,
 * no in-memory truth.
 *
 * Slice 27: optional `compactionEnforcer` participates in each polling
 * tick after persistence so policy-driven /compact triggers fire on the
 * same observation the operator sees in the UI. Without an enforcer
 * provided, polling behavior is unchanged.
 */
export declare class ContextMonitor {
    private db;
    private store;
    private claudeContextProvisioner;
    private compactionEnforcer;
    private readinessCheckers;
    private usageSamples;
    private providerWindowSampler;
    private timer;
    private activePoll;
    constructor(db: Database.Database, store: ContextUsageStore, claudeContextProvisioner?: ClaudeContextProvisioner, compactionEnforcer?: ClaudeCompactionEnforcer, readinessCheckers?: Record<string, RuntimeReadinessChecker | undefined>, usageSamples?: UsageSamplesStore, providerWindowSampler?: () => ProviderWindowSampleInput[]);
    /** Discover active managed Claude sessions and poll their sidecar files. */
    pollOnce(): Promise<void>;
    private runPoll;
    /** 51-08 A1: drain the provider-window supplier once per tick, advance-only.
     *  Defensive parity with the enforcer seam: a supplier fault never breaks polling. */
    private drainProviderWindowSamples;
    /**
     * Slice 27 — invoke the enforcer with the latest observation. The
     * enforcer owns policy + dedup + send; ContextMonitor only relays
     * data and absorbs enforcer errors so a trigger-path fault never
     * crashes telemetry polling.
     *
     * Only a fresh, known sample can start a compaction. A stale or unknown
     * sample still drains a post-compact stage that is already pending: the
     * seat may take no turn after /compact, and only a turn refreshes its
     * sample.
     */
    private maybeAutoCompact;
    /** Readiness normalization changes these two fields itself; all other snapshot
     * fields, including the launch event sequence, must still describe this seat. */
    private isCurrentSession;
    /** Start polling at the given interval. Idempotent. */
    start(intervalMs?: number): void;
    /** Stop polling. Safe to call before start or multiple times. */
    stop(): void;
    /** Query for managed runtime sessions with readable context sources. */
    private getEligibleSessions;
    private readContextUsage;
    private normalizeStartupStatus;
}
export {};
//# sourceMappingURL=context-monitor.d.ts.map