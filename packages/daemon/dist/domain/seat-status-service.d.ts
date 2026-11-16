import type { RigRepository } from "./rig-repository.js";
import type { NodeInventoryEntry, SeatIdentityVerdict } from "./types.js";
import { type StoredNativePermissionSelection, type ResolvedSeatPermission } from "./native-permission-store.js";
import { type StoredAppliedLaunchObservation } from "./applied-launch-observation-store.js";
export interface SeatStatus {
    seat_ref: string;
    rig_id: string;
    rig_name: string;
    logical_id: string;
    pod_id: string | null;
    pod_namespace: string | null;
    runtime: string | null;
    current_occupant: string | null;
    session_status: string | null;
    session_reason: SeatIdentityVerdict["reason"];
    startup_status: NodeInventoryEntry["startupStatus"];
    occupant_lifecycle: NodeInventoryEntry["occupantLifecycle"];
    continuity_outcome: NodeInventoryEntry["continuityOutcome"];
    handover_result: NodeInventoryEntry["handoverResult"];
    previous_occupant: string | null;
    handover_at: string | null;
    restore_outcome: NodeInventoryEntry["restoreOutcome"];
    permissions: {
        selectionState: "explicit" | "inherit" | "unknown";
        desired: StoredNativePermissionSelection | null;
        lastLaunchArguments: StoredAppliedLaunchObservation | null;
        nativeEffect: "unverified";
        error?: string;
        effective?: ResolvedSeatPermission;
    };
}
export type SeatStatusResult = {
    ok: true;
    status: SeatStatus;
} | {
    ok: false;
    code: "seat_ref_required" | "seat_not_found";
    message: string;
    guidance: string;
} | {
    ok: false;
    code: "seat_ambiguous";
    message: string;
    guidance: string;
    matches: Array<{
        rig_name: string;
        logical_id: string;
        current_occupant: string | null;
    }>;
};
export declare class SeatStatusService {
    private rigRepo;
    constructor(deps: {
        rigRepo: RigRepository;
    });
    getStatus(seatRef: string): SeatStatusResult;
    private findMatches;
    private entriesForRig;
    private projectStatus;
    private permissionStatus;
}
//# sourceMappingURL=seat-status-service.d.ts.map