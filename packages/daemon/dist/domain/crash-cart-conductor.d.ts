/** The shipped closed per-rig union (never widened at the fleet layer). `not_attempted`
 *  is first-class — a rig the conductor did not reach (no usable snapshot, or cancelled). */
export type PerRigOutcome = "fully_restored" | "partially_restored" | "failed" | "not_attempted";
/** One rig's conductor result. `receiptRef` references the durable restore event/attempt
 *  seq (the ledger lineage) — the conductor RENDERS receipts, it never re-authors them. */
export interface ConductorRigResult {
    rigId: string;
    outcome: PerRigOutcome;
    receiptRef?: string | number;
    /** Per-rig triage rows (seats needing operator action) — the fleet
     *  attention_required is the UNION of these across the sequence. */
    attention?: AttentionRow[];
    /** R3 — for a `not_attempted` rig, WHY it was skipped (no honest gap left blank). */
    reason?: string;
    /** R3 — the operator action that would let this rig be restored next time. */
    remediation?: string;
}
export interface RestoreConductorDeps {
    /** Rigs in restore order — KERNEL FIRST (the supervisor), then the rest. */
    listRigsInOrder: () => Array<{
        rigId: string;
        isKernel: boolean;
    }>;
    /** Restore ONE rig. Default (wired at the route) = findLatestRestoreUsable(rigId) →
     *  RestoreOrchestrator.restore(snapshotId) → rollupRestoreRigResult; a rig with no
     *  usable snapshot returns `not_attempted` (never a silent older/partial substitute). */
    restoreRig: (rigId: string) => Promise<{
        outcome: PerRigOutcome;
        receiptRef?: string | number;
        attention?: AttentionRow[];
        reason?: string;
        remediation?: string;
    }>;
    /** Cancel signal, polled at each rig BOUNDARY (stop-before-next-rig). Optional. */
    isCancelled?: () => boolean;
}
export declare class RestoreConductor {
    private readonly deps;
    constructor(deps: RestoreConductorDeps);
    /** Restore the fleet, kernel-first, best-effort, honoring stop-before-next-rig cancel.
     *  Returns the ordered per-rig sequence (Atom C aggregates it into the FleetRollup). */
    restoreFleet(opts?: {
        onRigDone?: (result: ConductorRigResult) => void;
    }): Promise<ConductorRigResult[]>;
}
/** Deps for the DEFAULT per-rig restore — structurally typed so the conductor stays
 *  decoupled from the full orchestrator (the real wiring passes
 *  `snapshotRepo.findLatestRestoreUsable` and `RestoreOrchestrator.restore`, whose
 *  RestoreOutcome satisfies this shape). */
export interface RestoreRigDeps {
    /** Newest restore-usable snapshot for the rig, or null (→ `not_attempted`; never a silent substitute). */
    findLatestRestoreUsable: (rigId: string) => {
        id: string;
    } | null;
    /** Optional richer selector. Production supplies it so the restore attempt
     * records why crash-cart chose this source; legacy test/integration callers
     * may keep the historical finder-only shape. */
    selectRestoreUsable?: (rigId: string) => {
        ok: true;
        snapshot: {
            id: string;
        };
        selection: import("./types.js").RestoreSnapshotSelection;
    } | {
        ok: false;
    };
    /** The shipped per-rig restore. `onAttemptStarted` yields the restore-started event seq = the receipt ref. */
    restore: (snapshotId: string, opts?: {
        onAttemptStarted?: (attemptId: number) => void;
        snapshotSelection?: import("./types.js").RestoreSnapshotSelection;
    }) => Promise<{
        ok: boolean;
        result?: {
            rigResult: PerRigOutcome;
            nodes?: RestoreNodeLite[];
        };
    }>;
}
/** One seat of the subset-launch result, structurally the shipped RestoreNodeResult
 *  subset the triage mapper reads. */
export interface AdoptSubsetSeat extends RestoreNodeLite {
    logicalId: string;
}
/** Structural slice of RestoreOrchestrator.launchNodeSubset's result — the shipped
 *  per-seat resume-verification machinery (FR-7: an unverifiable resume fail-closes
 *  to awaiting-decision carrying the exact `--fresh <logicalId>` remediation). */
export interface AdoptSubsetResult {
    ok: boolean;
    code?: string;
    message?: string;
    launched?: AdoptSubsetSeat[];
    held?: Array<{
        logicalId: string;
        reason: string;
    }>;
    alreadyRunning?: Array<{
        logicalId: string;
    }>;
    failedTargets?: Array<{
        logicalId: string;
        reason: string;
    }>;
}
export interface AdoptRigDeps {
    /** The rig's DB-running sessions whose tmux panes are ALIVE — the same
     *  classification restore's 409 guard runs (sessionRegistry rows ×
     *  tmuxAdapter.hasSession); the conductor never invents a probe. */
    probeLiveSessions: (rigId: string) => Promise<Array<{
        sessionName: string;
        logicalId: string;
    }>>;
    /** The shipped no-launch adopt (ClaimService.reconcileSession — the
     *  `rig reconcile-session` precedent): session state only, never input. */
    reconcileSession: (sessionName: string) => Promise<{
        ok: boolean;
        code?: string;
        message?: string;
    }>;
    /** The rig's full seat roster (logical ids) — adoption's complement is what
     *  per-seat resume verification must cover. */
    listRigSeats: (rigId: string) => string[];
    /** The shipped subset launcher over the NOT-adopted seats. */
    launchNodeSubset: (rigId: string, logicalIds: string[]) => Promise<AdoptSubsetResult>;
}
/** Build the default `restoreRig` dep: COMPOSE findLatestRestoreUsable → restore →
 *  rigResult. A rig with no usable snapshot is `not_attempted` (restore never runs);
 *  a restore that fails outright is `failed`. Never re-authors restore logic.
 *  With `adoptDeps` wired (Amendment 2), a rig whose panes survived takes the ADOPT
 *  branch above; DEAD panes (and callers without adoptDeps) run unchanged. */
export declare function createDefaultRestoreRig(_deps: RestoreRigDeps, adoptDeps?: AdoptRigDeps): (rigId: string) => Promise<{
    outcome: PerRigOutcome;
    receiptRef?: number;
    attention?: AttentionRow[];
    reason?: string;
    remediation?: string;
}>;
export interface RigOrderDeps {
    /** All (non-archived) rigs on this host — the conductor's fleet scope, v1. */
    listRigs: () => Array<{
        id: string;
        name: string;
    }>;
}
/** R2 — the founder's order: the KERNEL rig (the supervisor, name "kernel") restores
 *  FIRST, then the remaining rigs in listRigs order. No kernel rig → all rigs, none
 *  flagged kernel (honest, never fabricated). This is the `listRigsInOrder` source the
 *  conductor consumes. */
export declare function listRigsInKernelFirstOrder(deps: RigOrderDeps): Array<{
    rigId: string;
    isKernel: boolean;
}>;
/** A triage row: a seat + exactly what it needs (picker/auth/remediation), sourced
 *  from the shipped per-rig restore-check attention projection. The fleet
 *  `attention_required` is the UNION of these across rigs — a VIEW, not a parallel record. */
export interface AttentionRow {
    rigId: string;
    seat: string;
    need: string;
}
/** Fleet rollup — PURE AGGREGATION over the conductor's per-rig sequence. The per-rig
 *  outcome stays the shipped CLOSED union (never widened). NO fleet verdict is stored
 *  here — a stored verdict could drift from the per-rig truth; derive it on demand via
 *  {@link deriveFleetVerdict}. `not_attempted` is first-class (never folded into failed). */
export interface FleetRollup {
    counts: Record<PerRigOutcome, number>;
    sequence: ConductorRigResult[];
    attention_required: AttentionRow[];
}
/** The fleet verdict is a DERIVED function of the counts — never a stored field. */
export type FleetVerdict = "all_fully_restored" | "all_failed" | "none_attempted" | "mixed";
/** A restore node (structural subset of the shipped RestoreNodeResult) — enough to
 *  build a triage row from the seats that need operator action. */
export interface RestoreNodeLite {
    logicalId: string;
    status: string;
    error?: string;
    attentionEvidence?: string | null;
}
/** R5 — map a rig's restore nodes → triage rows: the seats needing operator action
 *  (a LIVE runtime prompt, an unresumable session, or a hard failure), each with its
 *  EXACT need. Running/resumed nodes are excluded. Never fabricates a need. */
export declare function attentionRowsFromNodes(rigId: string, nodes: RestoreNodeLite[]): AttentionRow[];
export declare function aggregateFleetRollup(sequence: ConductorRigResult[]): FleetRollup;
/** DERIVED f(counts) — computed, never stored (a stored verdict could drift). */
export declare function deriveFleetVerdict(counts: Record<PerRigOutcome, number>): FleetVerdict;
//# sourceMappingURL=crash-cart-conductor.d.ts.map