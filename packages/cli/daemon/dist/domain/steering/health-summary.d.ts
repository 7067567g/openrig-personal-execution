import type Database from "better-sqlite3";
import type { RigRepository } from "../rig-repository.js";
export interface NodeHealthSummary {
    /** Total nodes across all rigs. */
    total: number;
    /** Counts grouped by node.sessionStatus (running / detached / exited / unknown). */
    bySessionStatus: Record<string, number>;
    /** Counts grouped by lifecycleState (running / recoverable / detached / attention_required). */
    byLifecycle: Record<string, number>;
    /** Convenience tally for the steering surface's headline number. */
    attentionRequired: number;
}
export interface ContextHealthSummary {
    /** Total nodes that the context store knows about. */
    total: number;
    /** Counts grouped by context urgency (critical / warning / low / unknown). */
    byUrgency: Record<string, number>;
    /** Counts grouped by freshness of the last sample (fresh / stale / none). */
    byFreshness: Record<string, number>;
    /** Convenience tallies the steering surface foregrounds. */
    critical: number;
    warning: number;
    stale: number;
}
export declare function computeNodeHealthSummary(deps: {
    db: Database.Database;
    rigRepo: RigRepository;
}): NodeHealthSummary;
/** Reduces context_usage rows into the steering health summary.
 *  Urgency derived from usedPercentage thresholds (≥80 critical, ≥60
 *  warning, otherwise low). Freshness derived from sampledAt age vs
 *  FRESHNESS_THRESHOLD_S (300s). Reads context_usage directly because
 *  ContextUsageStore intentionally exposes per-node accessors only;
 *  listing all rows is a steering-surface concern, not a per-node
 *  concern. */
export declare function computeContextHealthSummary(deps: {
    db: Database.Database;
}): ContextHealthSummary;
//# sourceMappingURL=health-summary.d.ts.map