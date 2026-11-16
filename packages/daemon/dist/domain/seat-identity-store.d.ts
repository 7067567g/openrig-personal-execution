import type Database from "better-sqlite3";
import type { SeatIdentityVerdict } from "./types.js";
/**
 * OPR.0.4.3.19 — explicit, durable store for the per-node liveness identity
 * verdict (migration 046 `seat_identity_verdicts`). The reconciler writes;
 * node-inventory reads. Kept as a thin, stateless wrapper over the table so
 * the liveness truth lives in the DB, never in transient in-memory state
 * (dev-guard plan-review caveat).
 *
 * Reads are DEFENSIVE: fixtures that bypass the canonical migration list (no
 * `seat_identity_verdicts` table) get an empty map/undefined rather than a
 * crash — the projection degrades to "no verdict" (never down-ranks), matching
 * the fail-open-on-unknown contract.
 */
export declare class SeatIdentityStore {
    private readonly db;
    constructor(db: Database.Database);
    /** Upsert one node's verdict (last-writer-wins per node). */
    upsert(v: SeatIdentityVerdict): void;
    /** Read all verdicts for the nodes of a rig, keyed by node_id. Defensive. */
    getForRig(rigId: string): Map<string, SeatIdentityVerdict>;
    /**
     * FS-1 W1.2 — all rigs' verdicts in ONE query, keyed rigId → (nodeId →
     * verdict). Same JOIN + `rowToVerdict` as `getForRig`, minus the per-rig
     * WHERE — so a per-rig `getForAllRigs().get(rigId)` is equivalent to
     * `getForRig(rigId)` (empty map when a rig has no verdicts). Defensive.
     */
    getForAllRigs(): Map<string, Map<string, SeatIdentityVerdict>>;
    /** Read a single node's verdict, or null. Defensive. */
    getForNode(nodeId: string): SeatIdentityVerdict | null;
    /** Drop verdicts for nodes no longer in the live set (memory/table hygiene). */
    pruneExcept(liveNodeIds: string[]): void;
}
/** 51-09 increment 1 — the durable daemon self-host identity record. */
export interface SelfHostIdentityRecord {
    hostId: string;
    mintedAt: string;
    reconciledAt: string;
}
/**
 * 51-09 increment 1 — thin durable store for the daemon's own self-host id
 * (migration 059 `self_host_identity`, singleton row). Co-located with the
 * seat-identity substrate per arch ruling cb19867f (extend, do not invent a
 * parallel identity store). The reconciler mints once + reconciles at boot; this
 * store is the DB access seam only (no policy — mint/reconcile decisions live in
 * seat-identity-reconciler.ts). Reads are DEFENSIVE (table absent → null),
 * matching SeatIdentityStore's fixture-tolerant contract.
 */
export declare class SelfHostIdentityStore {
    private readonly db;
    constructor(db: Database.Database);
    /** The current self-host record, or null when none has been minted. */
    get(): SelfHostIdentityRecord | null;
    /** Insert the singleton self-host record (first boot only). minted_at == reconciled_at at mint. */
    mint(hostId: string, nowIso: string): SelfHostIdentityRecord;
    /** Advance reconciled_at on the existing singleton row; host_id + minted_at are never touched. */
    touchReconciledAt(nowIso: string): void;
}
//# sourceMappingURL=seat-identity-store.d.ts.map