/** The op-kinds converge() implements this release. The rest are classified-deferred. */
export const SUPPORTED_OP_KINDS = ["add_member", "reconcile_session"];
export function isSupportedOpKind(kind) {
    return SUPPORTED_OP_KINDS.includes(kind);
}
/** Honest message for a classified-but-unsupported op-kind (never silently skipped). */
export const DEFERRED_OP_REASON = "detected, not yet supported in this release";
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
export function diffTopology(declared, live) {
    const ops = [];
    const liveById = new Map(live.map((m) => [m.logicalId, m]));
    const declaredIds = new Set(declared.map((m) => `${m.pod}.${m.id}`));
    for (const m of declared) {
        const qualifiedId = `${m.pod}.${m.id}`;
        const liveMatch = liveById.get(qualifiedId);
        if (!liveMatch) {
            ops.push({ kind: "add_member", pod: m.pod, member: m.fragment });
        }
        else if (liveMatch.runtime !== m.runtime) {
            ops.push({ kind: "change_runtime", logicalId: qualifiedId, runtime: m.runtime });
        }
    }
    for (const m of live) {
        if (!declaredIds.has(m.logicalId)) {
            ops.push({ kind: "remove_member", logicalId: m.logicalId });
        }
    }
    return ops;
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
export async function convergeOp(deps, rigId, op, rigRoot, opts) {
    switch (op.kind) {
        case "add_member": {
            const outcome = await deps.instantiator.addMemberToPod(rigId, op.pod, op.member, rigRoot, {
                cwdOverride: opts?.cwdOverride,
                edges: op.edges,
            });
            return { kind: "add_member", supported: true, outcome };
        }
        case "reconcile_session": {
            if (!deps.claimService) {
                return {
                    kind: "reconcile_session",
                    supported: true,
                    outcome: { ok: false, code: "reconcile_error", message: "Claim service unavailable; cannot reconcile." },
                };
            }
            const outcome = await deps.claimService.reconcileSession({
                sessionName: op.sessionName,
                rigId: op.rigId,
                logicalId: op.logicalId,
            });
            return { kind: "reconcile_session", supported: true, outcome };
        }
        case "remove_member":
        case "move_member":
        case "fork_member":
        case "change_runtime":
            return { kind: op.kind, detected: true, supported: false, reason: DEFERRED_OP_REASON };
        default: {
            const _exhaustive = op;
            throw new Error(`Unknown topology op kind: ${_exhaustive.kind}`);
        }
    }
}
//# sourceMappingURL=topology-converge.js.map