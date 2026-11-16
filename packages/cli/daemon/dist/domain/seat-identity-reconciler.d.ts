import { type NativeProcessLister } from "./native-process-lineage.js";
import type Database from "better-sqlite3";
import type { TmuxAdapter } from "../adapters/tmux.js";
import { SelfHostIdentityStore } from "./seat-identity-store.js";
/** Default identity-reconcile cadence: 5s. Process identity changes rarely
 *  (a seat's pane/process is stable for its whole life), and the check is
 *  more expensive than the 1Hz activity poll (per-seat pane PID + command
 *  tmux reads), so a slower cadence is the right cost/freshness trade. */
export declare const DEFAULT_IDENTITY_POLL_INTERVAL_MS = 5000;
/**
 * Legacy short-command classifier. Codex callers additionally require the
 * shared native-process proof; this label alone is not positive Codex identity.
 *
 * Deliberately LENIENT to preserve the slice-15 no-false-green-for-live-seats
 * invariant: a genuinely-live claude/codex TUI usually reports its host
 * process (`node`) as `pane_current_command`, NOT the literal runtime name, so
 * we only declare `mismatch` on a POSITIVE contradiction — a different known
 * agent runtime, or a bare shell where an agent was expected (the process
 * died / an orphan shell squatted the pane). Ambiguous commands (`node`,
 * `python`, empty) never down-rank.
 *
 * Mirrors SessionFingerprinter's Layer-1 process-command vocabulary; we do NOT
 * run the full 4-layer scan (cmux query + pane-content capture) per poll — it
 * is far more expensive at fleet scale and its content layer would not change
 * the down-rank decision here (the reconcile only needs to distinguish
 * "process contradicts the seat" from "no contradiction").
 */
export declare function classifyPaneRuntimeMatch(command: string | null, expectedRuntime: string | null): "match" | "mismatch";
export interface SeatIdentityReconcilerDeps {
    db: Database.Database;
    tmux: Pick<TmuxAdapter, "listSessions" | "getPanePid" | "getPaneCommand"> & Partial<Pick<TmuxAdapter, "readAllPaneProcesses" | "listPanes">>;
    now?: () => Date;
    listProcesses?: NativeProcessLister;
}
/**
 * OPR.0.4.3.19 — periodic reconciler for the liveness identity verdict (the
 * THIRD axis). Mirrors SeatActivityService.start(): polls every running
 * tmux-bound managed seat, reconciles the current pane PID/command against the
 * registered seat, and persists the verdict to `seat_identity_verdicts`.
 * Projections then read the cheap persisted verdict synchronously.
 *
 * Non-inference: this reconciler reads ONLY tmux pane process identity vs the
 * registered binding. It NEVER reads queue/classifier/hook heartbeats, and it
 * does NOT touch `terminalActive` / `hasAssignedWork`.
 */
export declare class SeatIdentityReconciler {
    private readonly db;
    private readonly tmux;
    private readonly now;
    private readonly store;
    private readonly listProcesses;
    private timer;
    private reconciling;
    private generation;
    constructor(deps: SeatIdentityReconcilerDeps);
    private runningSeats;
    /** Reconcile every running tmux-bound seat once and persist the verdicts. */
    reconcileAll(): Promise<void>;
    private reconcileSweep;
    private tmuxUnavailableVerdict;
    private computeVerdict;
    /** Start the scheduler. Idempotent — calling twice is a no-op. */
    start(intervalMs?: number): void;
    /** Stop the scheduler. Safe to call before start or multiple times. */
    stop(): void;
}
/**
 * Reserved / non-identity host tokens that must NEVER become a self-host id: the
 * registry reserved set ({kernel, host, local}, hosts-registry-reader) plus the
 * bare display default "localhost" (host.name's default — display-only per DP4,
 * never an identity). Compared case-insensitively.
 */
export declare const RESERVED_SELF_HOST_SEEDS: Set<string>;
/**
 * Assert a self-host id is never empty and never a reserved/display token.
 * Throws (loud, fail-closed) if violated — the never-'local' invariant guard.
 */
export declare function assertNeverReservedHostId(hostId: string): void;
/**
 * Where a live self-host id CAME FROM, derived at read time — `named`, `generated`, or the honest
 * `indeterminate`.
 *
 * WHY DERIVED AND NOT READ: `self_host_identity` stores `host_id`, `minted_at`, `reconciled_at` and
 * NOTHING about provenance, so there is no record to consult. Recording it properly is a migration
 * and belongs with the population work, not here.
 *
 * `indeterminate` is load-bearing, not a cop-out. It is exactly the CONFLICT state the reconciler
 * already warns about: an operator sets `host.name` AFTER the id was minted, the reconciler keeps
 * the original id (a durable identity is never silently re-keyed), and from then on the configured
 * name and the live id disagree. Calling that `generated` would be a false claim about a machine
 * someone did name, and an unknown that reads as a known state is the whole defect this slice is
 * about.
 */
export type SelfHostIdSource = "named" | "generated" | "indeterminate";
export declare function deriveSelfHostIdSource(hostId: string | null | undefined, hostNameCandidate: string | null | undefined): SelfHostIdSource | null;
/**
 * 51-09 increment 2b — the FAIL-CLOSED registry-alignment assert. A durable
 * self-host id that is not a valid registry id could not be resolved by a remote
 * host as a key (transport-carries-host breaks), so it is a fatal boot
 * misconfiguration. Escalates increment 1's loud-conflict posture to a
 * fail-closed assert-on-boot for the registry-alignment case, per the ruling.
 */
export declare function assertSelfHostIdRegistryAligned(hostId: string): void;
export interface SelfHostReconcileResult {
    hostId: string;
    minted: boolean;
    /**
     * Populated (non-null) when a stored id already exists AND an operator
     * candidate (host.name) differs from it — the identity is NEVER silently
     * re-keyed; the stored id is kept and the conflict is surfaced loudly. This is
     * the general loud-conflict mechanism increment 2 reuses for self-id ↔
     * registry-id alignment.
     */
    conflict: {
        storedId: string;
        candidate: string;
    } | null;
}
/**
 * 51-09 increment 1 — mint-or-reconcile the daemon's durable self-host id at
 * boot. First boot MINTS (seeding from an unambiguous operator host.name where
 * present, else a generated collision-safe id); every subsequent boot RECONCILES
 * (advances reconciled_at, keeps the id — restart ⇒ same id). host.name is a
 * DISPLAY-ONLY candidate seed (arch ruling cb19867f / DP4); a reserved/default
 * candidate is rejected in favour of a generated id. When a stored id exists and
 * the operator candidate now differs, the id is KEPT (never silent re-key) and a
 * LOUD conflict naming BOTH is surfaced.
 */
export declare function reconcileSelfHostIdentity(store: SelfHostIdentityStore, opts: {
    nowIso: string;
    hostNameCandidate?: string | null;
    log?: (message: string) => void;
}): SelfHostReconcileResult;
//# sourceMappingURL=seat-identity-reconciler.d.ts.map