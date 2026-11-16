import type Database from "better-sqlite3";
import type { RestoreSnapshotSelection, RestoreSnapshotSummary, Snapshot, SnapshotData } from "./types.js";
export type RestoreSnapshotSelectionOutcome = {
    ok: true;
    snapshot: Snapshot;
    selection: RestoreSnapshotSelection;
} | {
    ok: false;
    code: "snapshot_not_found" | "snapshot_wrong_rig" | "snapshot_unusable" | "no_usable_snapshot";
    message: string;
};
interface ListOptions {
    kind?: string;
    limit?: number;
}
export declare class SnapshotRepository {
    readonly db: Database.Database;
    constructor(db: Database.Database);
    createSnapshot(rigId: string, kind: string, data: SnapshotData): Snapshot;
    getSnapshot(id: string): Snapshot | null;
    findLatestAutoPreDown(rigId: string): Snapshot | null;
    /**
     * Returns the latest snapshot whose persisted `data` carries the minimum
     * structural metadata `RestoreOrchestrator.restore`'s pre-validation requires.
     *
     * OPR.0.3.4.9 Option Y: prefers the most-recent of the crash-insurance tier
     * {auto-pre-down, auto-periodic} -- the freshest of the two wins. A newer
     * auto-periodic beats a stale auto-pre-down (the crash fix); a genuinely-
     * fresher auto-pre-down still wins (graceful-cycle preserved). Manual,
     * pre_restore, and auto-rehydrate remain below the tier (unchanged).
     *
     * The SQL query orders by `(kind IN ('auto-pre-down','auto-periodic')) DESC,
     * created_at DESC, rowid DESC`. The in-memory loop validates each candidate and
     * skips snapshots with corrupted JSON or missing topology metadata, returning
     * the first usable row. Returns null when no usable snapshot exists.
     *
     * Distinct from `findLatestUsableSnapshot` (rig-repository.ts, L2): that
     * helper requires at least one persisted resume token and is consumed by
     * the lifecycle projection. This helper only requires structural metadata
     * `RestoreOrchestrator.restore` actually inspects, so terminal-only or
     * resume-tokenless rigs still resolve.
     */
    findLatestRestoreUsable(rigId: string): Snapshot | null;
    /** Resolve an exact or policy-ranked restore source and return the evidence
     * needed to make that decision legible before any restore mutation. */
    selectRestoreUsable(rigId: string, snapshotId?: string, nowMs?: number): RestoreSnapshotSelectionOutcome;
    getLatestSnapshot(rigId: string): Snapshot | null;
    listSnapshots(rigId: string, opts?: ListOptions): Snapshot[];
    pruneSnapshots(rigId: string, keepCount: number): number;
    /** OPR.0.3.4.9 — kind-scoped retention. Keeps the newest `keepCount` rows
     *  of the given kind and deletes only older rows of THAT kind. Never touches
     *  other kinds. Hard floor: keepCount >= 1 (never prune to zero). */
    pruneSnapshotsByKind(rigId: string, kind: string, keepCount: number): number;
    private restoreUsableRow;
    private rowToSnapshot;
}
export declare function summarizeSnapshot(snapshot: Snapshot, nowMs?: number): RestoreSnapshotSummary;
export declare function isRestoreUsableSnapshotData(data: unknown): data is SnapshotData;
export {};
//# sourceMappingURL=snapshot-repository.d.ts.map