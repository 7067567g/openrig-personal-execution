import type Database from "better-sqlite3";
import type { ClaudeManagedBlockFile } from "./managed-blocks.js";
import { type SeatEnv } from "./seat-env.js";
import type { Rig, Node, Edge, RigWithRelations, RigServicesRecord, RigServicesRecordInput, Snapshot, SessionSourceSpec } from "./types.js";
export declare function findLatestUsableSnapshot(db: Database.Database, rigId: string): Snapshot | null;
/**
 * FS-1 W1.2 — the all-rigs batched form of `findLatestUsableSnapshot`: the
 * latest snapshot per rig in ONE query (same `created_at DESC, id DESC` order),
 * each mapped through the shared `snapshotFromRowIfUsable`. Rigs with no usable
 * snapshot are simply absent from the map (callers default to null). Rides the
 * arch-D1.1 sibling-audit `snapshots(rig_id, created_at)` index candidate.
 */
export declare function findLatestUsableSnapshotsForAllRigs(db: Database.Database): Map<string, Snapshot>;
/**
 * OPR.0.3.3.19 - rig archive read filter. Default daemon reads EXCLUDE archived
 * rigs; explicit modes opt in. Mirrors the stream-items `--include-archived`
 * precedent (stream-store.list).
 */
export interface RigArchiveFilter {
    /** include both active and archived rigs */
    includeArchived?: boolean;
    /** return ONLY archived rigs */
    archivedOnly?: boolean;
}
/**
 * SQL condition fragment for the archive filter on a column (e.g. "archived_at"
 * or the aliased "r.archived_at"). Returns null when no filter applies
 * (includeArchived = include everything). Default (no filter) excludes archived.
 */
export declare function archiveWhereClause(col: string, filter?: RigArchiveFilter): string | null;
interface NodeOptions {
    role?: string;
    runtime?: string;
    model?: string;
    effort?: string;
    codexConfigProfile?: string;
    /** OPR.0.4.8.3 Seam B: per-seat permission_policy REF (builtin:<name> or spec-relative path). */
    permissionPolicy?: string;
    /** The member's declared launch environment (spec `env:`); not merged with the rig's. */
    env?: SeatEnv;
    cwd?: string;
    surfaceHint?: string;
    workspace?: string;
    restorePolicy?: string;
    packageRefs?: string[];
    podId?: string;
    agentRef?: string;
    profile?: string;
    label?: string;
    sessionSource?: SessionSourceSpec;
    resolvedSpecName?: string;
    resolvedSpecVersion?: string;
    resolvedSpecHash?: string;
}
export declare class RigRepository {
    readonly db: Database.Database;
    /** OPR.0.5.6.24 — born-armed (advisor-ruled birth-property principle):
     *  protection arms in the same act that creates the rig. Wired at startup;
     *  optional so repo construction stays dependency-free. */
    onRigCreated?: (rig: Rig) => void;
    constructor(db: Database.Database);
    createRig(name: string, installRoot?: string): Rig;
    /** Canonical bundle materialization folder, independent of seats' working directories. */
    getRigInstallRoot(rigId: string): string | null;
    /**
     * PL-007 Workspace Primitive — persist the typed workspace block on the
     * rigs row. Stored as JSON in `workspace_json` (migration 038). Pass
     * null to clear. Older test fixtures that bypass the canonical migration
     * list don't have the column; setter is a no-op in that case (the
     * caller's contract is "best-effort persistence"). Whoami / node-inventory
     * read this column to surface the rig's workspace block alongside cwd.
     */
    setRigWorkspace(rigId: string, workspace: import("./types.js").WorkspaceSpec | null): void;
    /** PL-007 — read the persisted workspace block for a rig. */
    getRigWorkspace(rigId: string): import("./types.js").WorkspaceSpec | null;
    setRigNonInterruptive(rigId: string, enabled: boolean): void;
    getRigNonInterruptive(rigId: string): boolean;
    /** Persist the rig-level `env:` block from the spec, or null to clear. */
    setRigEnv(rigId: string, env: SeatEnv | null): void;
    getRigEnv(rigId: string): SeatEnv | null;
    /** What a seat's process gets: its rig's `env:` with the member's own `env:` over it. A launch,
     *  a restore and a handover successor all read this, so they cannot disagree. */
    getEffectiveSeatEnv(nodeId: string): SeatEnv;
    /** OPR.0.4.8.3 Seam B — persist a rig's attached permission_policy REF (builtin:<name> or a
     *  spec-relative custom path), or null to clear. Mirrors setRigWorkspace (migration 056). */
    setRigPermissionPolicy(rigId: string, permissionPolicy: string | null): void;
    /** OPR.0.4.8.3 Seam B — read the persisted rig-level permission_policy REF (null when none). */
    getRigPermissionPolicy(rigId: string): string | null;
    /** #25 — persist the rig's selected Claude managed-block file (migration 085), or null for
     *  the CLAUDE.md default. Mirrors setRigPermissionPolicy. */
    setRigClaudeManagedBlockFile(rigId: string, file: ClaudeManagedBlockFile | null): void;
    /** #25 — the rig's selected Claude managed-block file, or null when it uses the default. */
    getRigClaudeManagedBlockFile(rigId: string): ClaudeManagedBlockFile | null;
    /** Seam B Guard-F1 — persist the RIG-level resolved attachment provenance (migration 058).
     *  declaringDir = the ORIGINAL declaring RigSpec dir; consumers must never re-resolve the
     *  raw relative ref against an unrelated operation root. No-op on pre-058 fixture DBs. */
    setRigPolicyProvenance(rigId: string, provenance: {
        origin: "builtin" | "custom" | "deliberate_none";
        resolvedTarget: string | null;
        declaringDir: string | null;
        launchPosture: "floor" | "full_bypass" | "auto";
    }): void;
    /** Seam B Guard-F1 — read the rig-level resolved attachment provenance (null when none). */
    getRigPolicyProvenance(rigId: string): {
        origin: "builtin" | "custom" | "deliberate_none";
        resolvedTarget: string | null;
        declaringDir: string | null;
        launchPosture: "floor" | "full_bypass" | "auto";
        /** the raw rig ref (056) alongside, for re-validation */
        rigRef: string | null;
    } | null;
    /** OPR.0.4.8.3 Seam B (R2, dev-guard ruling) — persist a node's RESOLVED policy attachment
     *  provenance (restart-stable: origin + resolved target + declaring dir + launch posture).
     *  Builtins carry resolvedTarget=null until the packaging leg's canonical path is ruled
     *  (PM lane c76c7153) — never a `builtin:<name>` echo. No-op on pre-057 fixture DBs. */
    setNodePolicyProvenance(nodeId: string, provenance: {
        origin: "builtin" | "custom" | "deliberate_none";
        resolvedTarget: string | null;
        declaringDir: string | null;
        launchPosture: "floor" | "full_bypass" | "auto";
    }): void;
    /** Re-point an EXISTING seat's own permission_policy REF (`rig policy apply --seat`); the caller
     *  writes its resolved provenance through setNodePolicyProvenance in the same transaction. Restore,
     *  resume and launches that read the stored seat use that provenance. A later launch from a spec that
     *  declares a policy rewrites the provenance but not this ref, so the two can then differ: this ref
     *  is what `rig export` emits, not necessarily the policy the seat launched with. */
    setNodePermissionPolicy(nodeId: string, permissionPolicy: string): void;
    /** Seam B (R2) — read a node's persisted policy provenance; null when none attached
     *  (or pre-057 DB). Restore consumers re-derive posture from this without the spec. */
    getNodePolicyProvenance(nodeId: string): {
        origin: "builtin" | "custom" | "deliberate_none";
        resolvedTarget: string | null;
        declaringDir: string | null;
        launchPosture: "floor" | "full_bypass" | "auto";
        /** The node's own raw ref (member-level; null when the attachment came from the rig). */
        nodeRef: string | null;
    } | null;
    /** PL-007 — defensive column probe on rigs (migration 038's
     *  workspace_json is absent in legacy test fixtures). */
    private hasRigColumn;
    addNode(rigId: string, logicalId: string, opts?: NodeOptions): Node;
    /** S5 (OPR.0.5.4.7) — the first supported nodes.model write (the inventory was insert-only;
     *  KI-5.3-9). Every managed resume/successor launch reads node.model at call time, so this
     *  UPDATE is the complete persistence half of set-model. Returns whether a row changed. */
    setNodeModel(nodeId: string, model: string): boolean;
    setNodeEffort(nodeId: string, effort: string): boolean;
    /** OPR.0.7.0.7: write or clear (null) a seat's explicit effort choice. Returns false when
     *  the column isn't available or no row matched, so a caller never reports a change from it. */
    setNodeEffortChoice(nodeId: string, choice: string | null): boolean;
    clearNodeEffort(nodeId: string): boolean;
    addEdge(rigId: string, sourceId: string, targetId: string, kind: string): Edge;
    getRig(rigId: string): RigWithRelations | null;
    listRigs(filter?: RigArchiveFilter, observe?: import("./request-phase-observer.js").QueryObservation): Rig[];
    /**
     * Returns the latest snapshot for this rig with at least one non-null resume token,
     * or null if no usable snapshot exists. Used by the lifecycle projection to derive
     * `recoverable` state.
     */
    findLatestUsableSnapshot(rigId: string): Snapshot | null;
    findRigsByName(name: string): Rig[];
    /** #174: seat-ref resolution sees only unarchived rigs, as default reads do since migration 042. */
    findUnarchivedRigsByName(name: string): Rig[];
    getRigSummaries(filter?: RigArchiveFilter): Array<{
        id: string;
        name: string;
        nodeCount: number;
        latestSnapshotAt: string | null;
        latestSnapshotId: string | null;
        hasServices: boolean;
        archivedAt: string | null;
    }>;
    /**
     * OPR.0.3.3.19 - soft-archive a rig: sets `archived_at`. The rigs row,
     * topology rows, and snapshots are all RETAINED (this is NOT the delete
     * path - contrast deleteRig). Returns false if the rig was already archived.
     */
    archiveRig(rigId: string): boolean;
    /** OPR.0.3.3.19 - reverse archive: clears `archived_at`. Returns false if not archived. */
    unarchiveRig(rigId: string): boolean;
    deleteRig(rigId: string): void;
    deleteNode(nodeId: string): void;
    setServicesRecord(rigId: string, record: RigServicesRecordInput): RigServicesRecord;
    /** A retained generation must not tear down a live generation's project. */
    getLiveServicesSuccessor(rigId: string, projectName: string): {
        id: string;
        name: string;
    } | null;
    getServicesRecord(rigId: string): RigServicesRecord | null;
    updateServicesReceipt(rigId: string, latestReceiptJson: string | null): RigServicesRecord | null;
    private rowToRig;
    private rowToNode;
    private rowToEdge;
    private rowToBinding;
    private rowToServicesRecord;
    private hasNodeColumn;
}
export {};
//# sourceMappingURL=rig-repository.d.ts.map