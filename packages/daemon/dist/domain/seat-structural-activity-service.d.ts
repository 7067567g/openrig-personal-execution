import type Database from "better-sqlite3";
import type { PaneCapture, TmuxAdapter } from "../adapters/tmux.js";
import { type PaneActivityClassification } from "./session-transport.js";
import { type CodexLimitBanner } from "./provider/codex-limit-banner.js";
/** A cached STRUCTURAL pane observation: the classifyPaneActivity verdict plus WHEN the pane was read
 *  as motion. observedAt is a LIVENESS timestamp (last time we saw the pane), NOT a hook-arrival age —
 *  that distinction is the whole point of constraint 2 (a real counter is not a real liveness verdict). */
export interface StructuralObservation {
    state: PaneActivityClassification["state"];
    reason: string;
    evidence: string | null;
    observedAt: string;
    /** Set when a later sweep found the pane unchanged since observedAt without capturing it. Freshness counts from it;
     *  observedAt stays the capture. */
    checkedAt?: string;
}
export declare const DEFAULT_STRUCTURAL_POLL_INTERVAL_MS = 1000;
export declare const DEFAULT_STRUCTURAL_STALE_MS = 5000;
/**
 * 5b82324b — the STRUCTURAL activity cache. Sibling of SeatActivityService (which reads ONLY the tmux
 * window_activity TIMESTAMP and is deliberately text-blind): this service captures pane TEXT once per
 * running tmux seat per tick and classifies it STRUCTURALLY via classifyPaneActivity (spinner shapes,
 * `esc to interrupt`, idle-prompt / status-bar signatures — never a verb allowlist, so a "Drizzling"-
 * style spinner reads as motion instead of a false park). The cache is READ (capture-FREE) by
 * attachAgentActivity so the `rig ps` ACTIVITY column reflects real pane motion for hook-less / stale-
 * hook / turn-boundary seats WITHOUT reintroducing the per-request capture storm the healthz-wedge
 * cheap-default removed. Two safety rules make the BACKGROUND path itself safe:
 *   (MF1) a read refuses a stale observation and a failed capture invalidates the prior row — a stale
 *         positive verdict never survives a capture outage or a same-name occupant transition; and
 *   (MF2) sweeps are SINGLE-FLIGHT and HELD until the real captures settle — a slow/stuck tmux can
 *         never accumulate overlapping whole-fleet captures (only one sweep's captures are ever in
 *         flight). We deliberately do NOT time-out a capture to release the guard: execCommand has no
 *         AbortSignal, so a wrapper timeout would release single-flight while the child process lives,
 *         letting a later sweep spawn MORE children — the storm at the process level. A permanently
 *         stuck tmux therefore degrades to "no structural signal" (honest, via MF1 age-expiry), never
 *         a storm. A kill-backed capture primitive (bounded abort) is a tmux-adapter follow-on.
 */
export declare class SeatStructuralActivityService {
    private readonly tmuxAdapter;
    private readonly now;
    private readonly captureLines;
    private readonly staleAfterMs;
    private readonly latestBySession;
    private readonly capturedActivity;
    private timer;
    private sweeping;
    private bannerEmitter;
    constructor(tmuxAdapter: Pick<TmuxAdapter, "capturePaneContent"> & Partial<Pick<TmuxAdapter, "capturePanesContent" | "readAllSessionWindowActivity" | "readAllSessionWindows">>, now?: () => Date, captureLines?: number, staleAfterMs?: number);
    /**
     * Attach the Codex limit-banner emitter (#763). Kept as late attachment
     * (rather than a constructor dep) so construction order with the activity
     * store is untouched: startup attaches it once the store exists.
     */
    attachCodexLimitBanner(emitter: (sessionName: string, banner: CodexLimitBanner | null, observedAt: Date) => void): void;
    /** The cached structural observation — ONLY while current (capture-FREE read). Returns null AND evicts
     *  once the observation is older than the freshness window, so a stalled/failed poller never leaves a
     *  stale positive verdict authoritative over an honest stale hook (MUST-FIX 1). */
    getStructuralActivity(sessionName: string): StructuralObservation | null;
    /** Capture + structurally classify one seat's pane, caching the observation keyed by session name. A
     *  null or failed capture INVALIDATES the prior row (never leaves a stale positive verdict) and
     *  returns null (MUST-FIX 1). `prefetched` (#308) is the sweep's batched capture: a session it holds (null = gone or
     *  empty) is used as is; one it lacks is captured here, per seat. */
    pollSeat(sessionName: string, prefetched?: Map<string, PaneCapture> | null, runtime?: string | null, agentApp?: string | null): Promise<StructuralObservation | null>;
    /** Refresh every running tmux-bound seat once. SINGLE-FLIGHT and HELD until the captures settle: a new
     *  sweep never starts while one is in flight (MUST-FIX 2), so a slow/stuck tmux can never accumulate
     *  overlapping whole-fleet captures — at most one sweep's worth (N seats) is ever in flight. */
    pollAllRunningTmuxSeats(db: Database.Database): Promise<void>;
    start(db: Database.Database, intervalMs?: number): void;
    stop(): void;
}
//# sourceMappingURL=seat-structural-activity-service.d.ts.map