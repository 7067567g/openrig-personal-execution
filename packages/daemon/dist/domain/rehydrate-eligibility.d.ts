import type Database from "better-sqlite3";
import type { RigWithRelations, Snapshot } from "./types.js";
export interface CurrentStateRehydrateEligibility {
    ok: boolean;
    blockers: string[];
}
/**
 * A crash snapshot remains trustworthy only while it names every occupant that
 * durable current state still identifies as active. Boot reconciliation turns
 * rows detached after abrupt substrate loss, so detached rows must participate:
 * a different session id or native resume identity is positive evidence that
 * the snapshot belongs to an older occupant. Ambiguous current state is also
 * not permission to revive a historical occupant; current-state capture
 * preserves the ambiguity and restore refuses it explicitly.
 */
export declare function snapshotMatchesCurrentOccupants(db: Database.Database, rig: RigWithRelations, snapshot: Snapshot): boolean;
/**
 * Determines whether current persisted DB state is sufficient to synthesize a
 * restore snapshot after volatile runtime state (tmux) disappeared.
 *
 * This is intentionally conservative. It does not claim provider continuity by
 * itself; it only says the existing restore orchestrator has enough persisted
 * input to attempt a normal restore from an on-demand snapshot.
 */
export declare function assessCurrentStateRehydrateEligibility(db: Database.Database, rig: RigWithRelations): CurrentStateRehydrateEligibility;
//# sourceMappingURL=rehydrate-eligibility.d.ts.map