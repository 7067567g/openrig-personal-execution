import type { RigRepository } from "./rig-repository.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
export interface SeatSwitchClientRequest {
    seatRef: string;
    /** Target a specific attached client; required when multiple are attached. */
    client?: string | null;
    /** Target window index; defaults to 0 (the canonical seat window). */
    toWindow?: number | null;
}
export interface SeatSwitchClientSuccess {
    seat_ref: string;
    session: string;
    window: number;
    target: string;
    client: string;
    /** VIEW-ONLY marker: switch-client never mutates routing/bindings/identity. */
    mutated: false;
    retargeted: true;
}
interface ClientRef {
    name: string;
    session: string;
}
export type SeatSwitchClientResult = {
    ok: true;
    result: SeatSwitchClientSuccess;
} | {
    ok: false;
    code: "seat_ref_required" | "seat_not_found" | "seat_ambiguous" | "missing_canonical_session" | "session_not_found" | "window_not_found" | "no_client" | "ambiguous_client" | "client_not_found" | "switch_failed" | "tmux_probe_failed";
    message: string;
    guidance?: string;
    /** Attached clients, surfaced on the ambiguous / not-found paths so the
     *  operator can re-run with an explicit --client. */
    clients?: ClientRef[];
    matches?: Array<{
        rig_name: string;
        logical_id: string;
        current_occupant: string | null;
    }>;
};
export declare class SeatSwitchClientService {
    private rigRepo;
    private tmuxAdapter;
    constructor(deps: {
        rigRepo: RigRepository;
        tmuxAdapter: TmuxAdapter;
    });
    /** Honest probe-failure result. The tmux adapter intentionally RETHROWS
     *  unexpected probe failures (permission / socket errors). Every probe here
     *  (hasSession / listWindows / listClients) routes a throw through this so it
     *  surfaces as a structured tmux_probe_failed (-> HTTP 502) that names the
     *  failed operation, never an unstructured 500. */
    private probeFailed;
    switchClient(req: SeatSwitchClientRequest): Promise<SeatSwitchClientResult>;
}
export {};
//# sourceMappingURL=seat-switch-client-service.d.ts.map