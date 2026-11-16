import { SeatStatusService } from "./seat-status-service.js";
export class SeatHandoverPlanner {
    statusService;
    constructor(deps) {
        this.statusService = new SeatStatusService({ rigRepo: deps.rigRepo });
    }
    plan(input) {
        const reason = input.reason?.trim() ?? "";
        if (!reason) {
            return {
                ok: false,
                code: "missing_reason",
                message: "Missing required option: --reason <reason>",
                guidance: "Provide an explicit handover reason, for example: --reason context-wall",
            };
        }
        const source = parseHandoverSource(input.source);
        if (!source.ok) {
            return source;
        }
        const statusResult = this.statusService.getStatus(input.seatRef);
        if (!statusResult.ok) {
            return statusResult;
        }
        if (!input.dryRun) {
            return {
                ok: false,
                code: "mutation_disabled",
                message: "Seat handover mutation is not implemented in this slice.",
                guidance: "Re-run with --dry-run to inspect the two-phase handover plan without changing topology.",
            };
        }
        return {
            ok: true,
            plan: buildPlan({
                seatRef: input.seatRef,
                status: statusResult.status,
                source: source.source,
                reason,
                operator: input.operator?.trim() || null,
            }),
        };
    }
}
/**
 * OPR.0.5.5.5 — the ONE source-capability table shared by the dry-run plan and
 * the mutation executor. The plan renders what a source DOES from this table
 * and the executor dispatches on the same rows, so the plan can never promise
 * a source the executor refuses (and vice versa). Adding a mode to
 * `SeatHandoverSourceMode` forces a row here (exhaustive Record).
 */
export const SEAT_HANDOVER_SOURCE_CAPABILITIES = {
    fresh: { executes: true, contextCarrier: "captured restore packet pasted to the fresh successor before commit" },
    discovered: { executes: true, contextCarrier: "operator-prepared successor; nothing is delivered" },
    fork: { executes: true, contextCarrier: "native fork of the resolved source conversation (the successor carries the incumbent context from its first byte; commit persists the NEW post-fork token)" },
    rebuild: { executes: true, contextCarrier: "durable artifact chain (authored recap / LEARNED / restore record) delivered as a priming packet; the executed set and its gaps are recorded" },
};
export function parseHandoverSource(source) {
    const raw = source?.trim();
    if (!raw || raw === "default" || raw === "fresh") {
        return {
            ok: true,
            source: { mode: "fresh", ref: null, raw: raw || "fresh", defaulted: !raw || raw === "default" },
        };
    }
    if (raw === "rebuild") {
        return {
            ok: true,
            source: { mode: "rebuild", ref: null, raw, defaulted: false },
        };
    }
    if (raw.startsWith("fork:")) {
        const ref = raw.slice("fork:".length).trim();
        if (ref) {
            return {
                ok: true,
                source: { mode: "fork", ref, raw, defaulted: false },
            };
        }
    }
    if (raw.startsWith("discovered:")) {
        const ref = raw.slice("discovered:".length).trim();
        if (ref) {
            return {
                ok: true,
                source: { mode: "discovered", ref, raw, defaulted: false },
            };
        }
    }
    return {
        ok: false,
        code: "invalid_source",
        message: `Invalid handover source "${raw}".`,
        guidance: "Use --source fresh, --source rebuild, --source fork:<id>, or --source discovered:<id>.",
    };
}
function buildPlan(input) {
    const { status } = input;
    return {
        ok: true,
        dryRun: true,
        willMutate: false,
        seat: {
            ref: input.seatRef,
            rigId: status.rig_id,
            rigName: status.rig_name,
            logicalId: status.logical_id,
            podId: status.pod_id,
            podNamespace: status.pod_namespace,
            runtime: status.runtime,
        },
        source: input.source,
        reason: input.reason,
        operator: input.operator,
        currentOccupant: status.current_occupant,
        currentStatus: {
            sessionStatus: status.session_status,
            startupStatus: status.startup_status,
            occupantLifecycle: status.occupant_lifecycle,
            continuityOutcome: status.continuity_outcome,
            handoverResult: status.handover_result,
            previousOccupant: status.previous_occupant,
            handoverAt: status.handover_at,
            restoreOutcome: status.restore_outcome,
        },
        phases: [
            {
                id: "prepare",
                title: "Phase A - prepare successor with seat binding unchanged",
                bindingUnchangedUntilComplete: true,
                steps: [
                    {
                        id: "validate-seat",
                        title: "Validate seat",
                        description: "Confirm the seat exists and capture current occupant/status from node inventory.",
                        willMutate: false,
                    },
                    {
                        id: "capture-departing-context",
                        title: "Capture departing context",
                        description: "Would collect final pane state, queue state, and session log tail before successor creation.",
                        willMutate: false,
                    },
                    {
                        id: "create-successor",
                        title: "Create successor occupant",
                        description: `Would create a successor using ${describeSource(input.source)} while leaving the current seat binding unchanged. Context carrier: ${SEAT_HANDOVER_SOURCE_CAPABILITIES[input.source.mode].contextCarrier}.`,
                        willMutate: false,
                    },
                    {
                        id: "verify-successor-readiness",
                        title: "Verify successor readiness",
                        description: "Would run runtime readiness checks before allowing any seat rebind.",
                        willMutate: false,
                    },
                ],
            },
            {
                id: "commit",
                title: "Phase B - commit atomic seat rebind after successor readiness",
                bindingUnchangedUntilComplete: false,
                steps: [
                    {
                        id: "archive-departing-occupant",
                        title: "Archive departing occupant",
                        description: "Would mark the departing occupant lifecycle and preserve handover provenance.",
                        willMutate: false,
                    },
                    {
                        id: "rebind-seat",
                        title: "Rebind seat",
                        description: "Would atomically point the stable seat identity at the successor session.",
                        willMutate: false,
                    },
                    {
                        id: "deliver-startup-context",
                        title: "Deliver startup context",
                        description: "Would deliver handover context through startup orchestration.",
                        willMutate: false,
                    },
                    {
                        id: "record-provenance",
                        title: "Record provenance",
                        description: "Would finalize the handover record and append the pod shared session log.",
                        willMutate: false,
                    },
                ],
            },
        ],
    };
}
function describeSource(source) {
    if (source.mode === "fork")
        return `fork source ${source.ref}`;
    if (source.mode === "discovered")
        return `already-created discovered successor ${source.ref}`;
    if (source.mode === "rebuild")
        return "artifact rebuild source";
    return source.defaulted ? "the default fresh source" : "fresh source";
}
//# sourceMappingURL=seat-handover-planner.js.map