import type { CaptureObserver, ObservedBinding } from "./capture-observer.js";
import type Database from "better-sqlite3";
import type { NodeInventoryEntry, NodeDetailEntry, NodeRestoreOutcome, NodeLifecycleState, Snapshot, SeatIdentityVerdictKind, SeatActivity } from "./types.js";
import type { RuntimeAdapter } from "./runtime-adapter.js";
import type { ContextUsageStore } from "./context-usage-store.js";
import type { TranscriptStore } from "./transcript-store.js";
import type { AgentActivityStore } from "./agent-activity-store.js";
import type { SeatActivityService } from "./seat-activity-service.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { StructuralObservation } from "./seat-structural-activity-service.js";
/**
 * Derives per-node lifecycle state from session/restore truth plus the rig's latest
 * usable snapshot.
 *
 * Priorities (post-L2):
 *   attention_required  — restoreOutcome=failed AND tmux session is alive
 *                         (v0 proxy for the Claude resume-prompt case; revisited in L3).
 *   running             — sessionStatus=running.
 *   recoverable         — non-running session AND the latest usable snapshot has a
 *                         non-null resume token for THIS node.
 *   detached            — anything else (no session, exited, detached without resume token).
 *
 * Permission/IO failures upstream (L1 fail-closed) leave sessionStatus unchanged, so
 * the projection stays honest without misclassifying ambiguous probe failures.
 */
export declare function deriveNodeLifecycleState(input: {
    sessionStatus: string | null;
    /** Startup attention is live seat state, independent of restore history. */
    startupStatus?: string | null;
    restoreOutcome: NodeRestoreOutcome;
    nodeId: string;
    usableSnapshot: Snapshot | null;
    /** OPR.0.4.3.19 — the persisted liveness identity verdict for this node.
     *  A `mismatch`/`pane_missing` verdict down-ranks a `running` session to
     *  `attention_required` (no false-green). `verified`, `tmux_unavailable`,
     *  and an absent verdict leave the projection unchanged. */
    identityVerdict?: SeatIdentityVerdictKind | null;
}): NodeLifecycleState;
/**
 * Get the canonical node inventory for a rig.
 * Single source of truth consumed by CLI, UI, and MCP.
 */
export declare function getNodeInventory(db: Database.Database, rigId: string): NodeInventoryEntry[];
export declare function getNodeInventoryForAllRigs(db: Database.Database): Map<string, NodeInventoryEntry[]>;
export declare function getNodeInventoryForRigs(db: Database.Database, rigIds: ReadonlySet<string>): Map<string, NodeInventoryEntry[]>;
/**
 * Get detailed node information including startup files, resources, and events.
 * The adapter dependency is optional — when provided, uses live listInstalled;
 * otherwise falls back to projection entries from startup context.
 */
export declare function getNodeDetail(db: Database.Database, rigId: string, logicalId: string, opts?: {
    adapters?: Record<string, RuntimeAdapter>;
    /** Pre-resolved installed resources from adapter.listInstalled() — route layer provides this. */
    installedResourcesOverride?: Array<{
        id: string;
        category: string;
        targetPath: string;
    }>;
}): NodeDetailEntry | null;
/**
 * Context-aware wrapper: returns inventory with context usage attached.
 * Uses one daemon-owned ContextUsageStore for all reads.
 */
export declare function getNodeInventoryWithContext(db: Database.Database, rigId: string, contextUsageStore: ContextUsageStore, transcriptStore?: Pick<TranscriptStore, "getIngestHealth">): NodeInventoryEntry[];
/**
 * Context-aware wrapper: returns node detail with context usage attached.
 */
export declare function getNodeDetailWithContext(db: Database.Database, rigId: string, logicalId: string, contextUsageStore: ContextUsageStore, opts?: Parameters<typeof getNodeDetail>[3]): NodeDetailEntry | null;
/**
 * Slice 15 — populate `terminalActive` + `hasAssignedWork` per node.
 *
 * Two orthogonal enrichments computed independently (non-inference
 * contract per IMPL-PRD §2.3):
 *   - `terminalActive`: read from SeatActivityService (tmux signal)
 *   - assigned-work counts: pending, in-progress, and blocked queue_items
 *     where destination_session matches either canonical coordinate for the seat
 *
 * Pure / synchronous — keeps the projection cheap for both `rig ps` and
 * the UI which both fetch this per-request. The two enrichments do not
 * read each other's source.
 */
export declare function attachTerminalActivityAndWork(entries: NodeInventoryEntry[], deps: {
    db: Database.Database;
    seatActivity?: SeatActivityService;
}): NodeInventoryEntry[];
/**
 * QA baseline-deep-dogfood BLOCKING-A2 (qitem-20260518063900-85745917):
 * adopted/live-session rigs do NOT surface assigned queue work because
 * the prior lookup matched destination_session ONLY against
 * canonicalSessionName.
 *
 * For MANAGED seats, canonicalSessionName equals the canonical form
 * `{pod}-{member}@{rig}` (set by deriveCanonicalSessionName at
 * materialize time) and queue operators address them by that form, so
 * the single-key lookup works.
 *
 * For ADOPTED seats, canonicalSessionName is the RAW tmux session
 * name (whatever the adopter chose, e.g., `my-existing-claude`).
 * Operators address adopted seats by the canonical form (logical
 * `{pod}-{member}@{rig}`) through `rig queue create --destination`,
 * so the single-key lookup misses.
 *
 * Resolve via BOTH forms:
 *   1. entry.canonicalSessionName (covers managed + adopted-by-raw)
 *   2. derived `{pod}-{member}@{rig}` from logicalId + rigName
 *      (covers adopted-by-canonical)
 *
 * The logicalId is the pod-aware `pod.member` form (dot-separated).
 * The canonical session form replaces the dot with a dash to match the
 * convention from deriveCanonicalSessionName (so `dev.driver-2` in
 * rig `my-rig` becomes `dev-driver-2@my-rig`).
 *
 * Sums distinct destination_session keys to avoid double-counting
 * when both forms are identical (managed seats whose
 * canonicalSessionName already equals the derived canonical form).
 */
export interface AssignedWorkCounts {
    assignedWorkCount: number;
    pendingWorkCount: number;
    inProgressWorkCount: number;
    blockedWorkCount: number;
}
export declare function countAssignedWorkForEntry(entry: NodeInventoryEntry, assignedByDest: Map<string, AssignedWorkCounts>): AssignedWorkCounts;
/** EXPORTED (OPR.0.4.6.FAC1): the derived canonical coordinate
 *  `{pod}-{member}@{rig}` for an inventory entry — the binding layer's
 *  ONE string rule (tiebreak key AND recorded destination) reuses
 *  exactly this dual-key derivation, never a parallel one. */
export declare function deriveCanonicalFromEntry(entry: NodeInventoryEntry): string | null;
export declare function readAssignedWorkBySession(db: Database.Database): Map<string, AssignedWorkCounts>;
export declare function attachAgentActivity(entries: NodeInventoryEntry[], deps: {
    tmuxAdapter: TmuxAdapter;
    activityStore?: AgentActivityStore;
    /** 5b82324b — the cached STRUCTURAL pane observation (SeatStructuralActivityService). READ-only
     *  and capture-FREE: lifts structural motion into the ACTIVITY signal on the DEFAULT path so a
     *  live hook-less/stale-hook seat stops rendering as `unknown`. Absent = the pre-5b behavior. */
    structuralActivity?: {
        getStructuralActivity(sessionName: string): StructuralObservation | null;
    };
    /** ACTIVITY D1+D2 — the cached MOTION observation (SeatActivityService, tmux
     *  `#{window_activity}` at 1Hz). READ-only and capture-FREE, same as `structuralActivity`.
     *
     *  This signal was already computed per seat and already rendered — in the SEPARATE `TERMINAL`
     *  column, and in the UI's own activity fold (activity-visuals.ts has returned
     *  `{state: "running", source: "terminal_activity"}` on `terminalActive === true` since slice
     *  15). ACTIVITY was the one consumer that never read it, which is why the web UI could show a
     *  seat working while `rig ps` called the same seat `unknown`. Absent = the pre-fix behavior. */
    seatActivity?: {
        getSeatActivity(sessionName: string): SeatActivity | null;
    };
    now?: Date;
    captureFallback?: boolean;
    captureObserver?: Pick<CaptureObserver, "record">;
    observationBinding?: (entry: NodeInventoryEntry) => Omit<ObservedBinding, "sessionName">;
}): Promise<NodeInventoryEntry[]>;
//# sourceMappingURL=node-inventory.d.ts.map