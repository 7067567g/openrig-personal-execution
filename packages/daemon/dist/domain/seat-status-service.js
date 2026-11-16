import { deriveCanonicalFromEntry, getNodeInventory } from "./node-inventory.js";
import { parseSessionName } from "./session-name.js";
import { NativePermissionStore } from "./native-permission-store.js";
import { AppliedLaunchObservationStore } from "./applied-launch-observation-store.js";
const SEAT_LOOKUP_GUIDANCE = "List seats with: rig ps --nodes";
export class SeatStatusService {
    rigRepo;
    constructor(deps) {
        this.rigRepo = deps.rigRepo;
    }
    getStatus(seatRef) {
        const ref = seatRef.trim();
        if (!ref) {
            return { ok: false, code: "seat_ref_required", message: "seat reference is required", guidance: SEAT_LOOKUP_GUIDANCE };
        }
        const matches = this.findMatches(ref);
        if (matches.length === 0) {
            return { ok: false, code: "seat_not_found", message: `Seat "${ref}" not found`, guidance: SEAT_LOOKUP_GUIDANCE };
        }
        if (matches.length > 1) {
            return {
                ok: false,
                code: "seat_ambiguous",
                message: `Seat "${ref}" matched multiple nodes`,
                guidance: SEAT_LOOKUP_GUIDANCE,
                matches: matches.map(({ entry }) => ({
                    rig_name: entry.rigName,
                    logical_id: entry.logicalId,
                    current_occupant: entry.canonicalSessionName,
                })),
            };
        }
        return { ok: true, status: this.projectStatus(ref, matches[0].entry) };
    }
    findMatches(ref) {
        // OPR.0.4.6.MH1 FR-8: the shared parse contract (greedy first-@ rig).
        const parsed = parseSessionName(ref);
        if (parsed.kind === "canonical") {
            const localRef = parsed.member;
            const rigName = parsed.rig;
            const rigs = this.rigRepo.findUnarchivedRigsByName(rigName);
            return rigs.flatMap((rig) => this.entriesForRig(rig.id).filter((entry) => entry.canonicalSessionName === ref
                || deriveCanonicalFromEntry(entry) === ref
                || entry.logicalId === localRef).map((entry) => ({ entry })));
        }
        return this.rigRepo.listRigs().flatMap((rig) => this.entriesForRig(rig.id).filter((entry) => entry.canonicalSessionName === ref || entry.logicalId === ref).map((entry) => ({ entry })));
    }
    entriesForRig(rigId) {
        return getNodeInventory(this.rigRepo.db, rigId);
    }
    projectStatus(seatRef, entry) {
        return {
            seat_ref: seatRef,
            rig_id: entry.rigId,
            rig_name: entry.rigName,
            logical_id: entry.logicalId,
            pod_id: entry.podId,
            pod_namespace: entry.podNamespace ?? null,
            runtime: entry.runtime,
            current_occupant: entry.canonicalSessionName,
            session_status: entry.sessionStatus,
            session_reason: entry.identityVerdict?.reason ?? null,
            startup_status: entry.startupStatus,
            occupant_lifecycle: entry.occupantLifecycle,
            continuity_outcome: entry.continuityOutcome,
            handover_result: entry.handoverResult,
            previous_occupant: entry.previousOccupant,
            handover_at: entry.handoverAt,
            restore_outcome: entry.restoreOutcome,
            permissions: this.permissionStatus(entry.nodeId, entry.runtime),
        };
    }
    permissionStatus(nodeId, runtime) {
        const lastLaunchArguments = new AppliedLaunchObservationStore(this.rigRepo.db).readCurrent(nodeId);
        try {
            const store = new NativePermissionStore(this.rigRepo.db);
            const desired = store.read(nodeId);
            const effective = runtime ? store.resolve(nodeId, runtime) : undefined;
            return { selectionState: desired ? "explicit" : "inherit", desired, lastLaunchArguments, nativeEffect: "unverified", ...(effective ? { effective } : {}) };
        }
        catch (error) {
            return { selectionState: "unknown", desired: null, lastLaunchArguments, nativeEffect: "unverified", error: error.message };
        }
    }
}
//# sourceMappingURL=seat-status-service.js.map