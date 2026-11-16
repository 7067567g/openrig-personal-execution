import type { PodRigInstantiator, AddMemberOutcome } from "./rigspec-instantiator.js";
import type { ClaimService, ReconcileSessionOutcome } from "./claim-service.js";
/**
 * Topology-mutation converge spine (OPR.0.3.3.24, AC-6 scaffold).
 *
 * The reconciler model is: diff(declaredSpec, liveTopology) -> Op[]; converge(op)
 * applies each supported op. This release IMPLEMENTS one op — `add_member` —
 * built on the extracted create-node + launch-binding primitives. The Op union
 * is COMPLETE-shaped (all reshape kinds typed) and the differ CLASSIFIES the
 * full set, but the identity-migrating kinds (remove/move/fork/change_runtime)
 * are CLASSIFIED-deferred to the 0.4.0 identity theme: they migrate or clone an
 * existing seat's identity (logical-id re-key + continuity_state migration +
 * queue re-route), which add_member deliberately does not.
 *
 * This is a SCAFFOLD, not a reconciler build: there is no `rig apply` loop here
 * (that is a design sketch this release). converge() never silently skips an
 * unsupported op — it reports it honestly as "detected, not yet supported".
 */
/** The complete topology-mutation op-kind set. */
export type TopologyOp = {
    kind: "add_member";
    pod: string;
    member: Record<string, unknown>;
    edges?: Array<{
        from: string;
        to: string;
        kind: string;
    }>;
} | {
    kind: "reconcile_session";
    sessionName: string;
    rigId?: string;
    logicalId?: string;
} | {
    kind: "remove_member";
    logicalId: string;
} | {
    kind: "move_member";
    logicalId: string;
    toPod: string;
} | {
    kind: "fork_member";
    logicalId: string;
    toMember: string;
} | {
    kind: "change_runtime";
    logicalId: string;
    runtime: string;
};
export type TopologyOpKind = TopologyOp["kind"];
/** The op-kinds converge() implements this release. The rest are classified-deferred. */
export declare const SUPPORTED_OP_KINDS: readonly TopologyOpKind[];
export declare function isSupportedOpKind(kind: TopologyOpKind): boolean;
/** Honest message for a classified-but-unsupported op-kind (never silently skipped). */
export declare const DEFERRED_OP_REASON = "detected, not yet supported in this release";
export type ConvergeResult = {
    kind: "add_member";
    supported: true;
    outcome: AddMemberOutcome;
} | {
    kind: "reconcile_session";
    supported: true;
    outcome: ReconcileSessionOutcome;
} | {
    kind: TopologyOpKind;
    detected: true;
    supported: false;
    reason: string;
};
/** A member as DECLARED in the desired spec (one pod-scoped member fragment). */
export interface DeclaredMember {
    pod: string;
    id: string;
    runtime: string;
    fragment: Record<string, unknown>;
}
/** A member as it exists LIVE in the rig today. */
export interface LiveMember {
    logicalId: string;
    runtime: string;
}
/**
 * Classify the difference between the declared members and the live topology
 * into the complete op-kind set. Scaffold semantics:
 *   - declared but not live              -> add_member        (IMPLEMENTED)
 *   - live but not declared              -> remove_member     (classified-deferred)
 *   - present in both, runtime differs   -> change_runtime    (classified-deferred)
 *
 * move_member and fork_member are part of the Op union (complete-shaped) but are
 * NOT auto-derivable from a flat declarative membership diff: a move is
 * indistinguishable from remove+add without stable-identity tracking, and a fork
 * is imperative-only (no declarative trigger). Detecting them needs the 0.4.0
 * identity model (durable state keyed on the stable node-id). convergeOp still
 * classifies them honestly when handed one directly.
 */
export declare function diffTopology(declared: DeclaredMember[], live: LiveMember[]): TopologyOp[];
/** The domain services the converge boundary composes per op kind (OPR.0.3.4.3:
 *  the spine grew a second implemented op, so convergeOp takes a deps object —
 *  add_member runs on the instantiator, reconcile_session on the claim service's
 *  no-input reconcile binding). */
export interface ConvergeDeps {
    instantiator: PodRigInstantiator;
    /** Required for reconcile_session ops; add_member-only callers may omit it. */
    claimService?: ClaimService;
}
/**
 * Apply a single topology op. `add_member` runs the extracted create-node +
 * launch-binding seam via PodRigInstantiator.addMemberToPod; `reconcile_session`
 * runs ClaimService.reconcileSession — the NO-LAUNCH, NO-INPUT adopt of a live
 * hand-resumed session into its persisted node (never reaches NodeLauncher.
 * launchNode or any pane-input primitive). Every other kind is reported honestly
 * as detected-but-unsupported (NEVER silently skipped). The agent-ergonomics
 * (json + honest 3-part errors) the CLI and MCP expose live ON this converge
 * boundary, so future verbs inherit human/agent parity.
 */
export declare function convergeOp(deps: ConvergeDeps, rigId: string, op: TopologyOp, rigRoot: string, opts?: {
    cwdOverride?: string;
}): Promise<ConvergeResult>;
//# sourceMappingURL=topology-converge.d.ts.map