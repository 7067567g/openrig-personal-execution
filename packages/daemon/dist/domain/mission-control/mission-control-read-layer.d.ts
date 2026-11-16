import type Database from "better-sqlite3";
import type { QueueRepository } from "../queue-repository.js";
import type { ViewProjector } from "../view-projector.js";
import type { StreamStore } from "../stream-store.js";
import type { MissionControlFleetCliCapability } from "./mission-control-fleet-cli-capability.js";
export declare const MISSION_CONTROL_VIEWS: readonly ["my-queue", "human-gate", "fleet", "active-work", "recent-ships", "recently-active", "recent-observations"];
export type MissionControlViewName = (typeof MISSION_CONTROL_VIEWS)[number];
/**
 * The 9-field phone-friendly content model. Per PRD § Acceptance
 * Criteria item 1, non-negotiable across all 7 views wherever
 * row-shaped status is shown. UI may render compact; JSON preserves
 * all 9 fields.
 *
 * 9 fields verbatim from PRD:
 *   1. rig/mission name
 *   2. current phase
 *   3. active/idle/attention/blocked/degraded
 *   4. next-action
 *   5. pending-human-decision
 *   6. read-cost (full / skim/approve / summary-only)
 *   7. last-update timestamp
 *   8. confidence/freshness
 *   9. evidence link
 */
export interface CompactStatusRow {
    rigOrMissionName: string;
    currentPhase: string | null;
    state: "active" | "idle" | "attention" | "blocked" | "degraded";
    nextAction: string | null;
    pendingHumanDecision: string | null;
    readCost: "full" | "skim/approve" | "summary-only" | null;
    lastUpdate: string;
    confidenceFreshness: string | null;
    evidenceLink: string | null;
    /** Carrier metadata (id used for verb actions). */
    qitemId?: string | null;
    rawSourceRef?: string | null;
    /** Human-readable qitem context for phone decisions. */
    qitemSummary?: string | null;
    qitemBody?: string | null;
}
export interface MissionControlReadResult {
    viewName: MissionControlViewName;
    rows: CompactStatusRow[];
    /**
     * Per-view metadata. Includes "rigs running stale CLI" indicator on
     * the fleet view (sub-clause 4 of graceful-degradation acceptance).
     */
    meta: {
        rowCount: number;
        rigsRunningStaleCli?: number;
        rigsWithUnknownCliCapabilities?: number;
        degradedFields?: string[];
        sourceFallback?: string;
    };
}
interface ReadLayerDeps {
    db: Database.Database;
    queueRepo: QueueRepository;
    viewProjector: ViewProjector;
    streamStore?: StreamStore;
    fleetCliCapability: MissionControlFleetCliCapability;
    /** Operator's default human-seat session for `my-queue`. */
    defaultOperatorSession?: string;
    now?: () => Date;
}
export declare class MissionControlReadLayer {
    private readonly queueRepo;
    private readonly viewProjector;
    private readonly streamStore;
    private readonly fleetCliCapability;
    private readonly defaultOperatorSession;
    constructor(deps: ReadLayerDeps);
    /** V0.3.1 slice 05 — public getter for the resolved operator seat
     *  session. Route handlers (listDestinations, audit history) read
     *  this so the picker + audit filter always offer the configured
     *  operator seat even when the kernel rig isn't booted yet. */
    getDefaultOperatorSession(): string;
    readView(viewName: MissionControlViewName, opts?: {
        operatorSession?: string;
    }): Promise<MissionControlReadResult>;
    private readMyQueue;
    private readHumanGate;
    private readFleet;
    private readActiveWork;
    private readRecentShips;
    private readRecentlyActive;
    private readRecentObservations;
}
export {};
//# sourceMappingURL=mission-control-read-layer.d.ts.map