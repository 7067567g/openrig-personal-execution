import type { TmuxAdapter } from "../adapters/tmux.js";
import type { SeatIdentityVerdict } from "./types.js";
export type PaneBindingObservation = {
    ok: true;
    pane: string;
} | {
    ok: false;
    code: "pane_missing" | "pane_ambiguous" | "tmux_unavailable";
    detail: string;
};
/** Observe the sole pane of one tmux session without mutating either tmux or DB. */
export declare function observeSolePane(tmux: Pick<TmuxAdapter, "listPanes">, sessionName: string): Promise<PaneBindingObservation>;
/** Durable named state for a launch/adopt/refresh ingress that cannot resolve a sole pane. */
export declare function paneObservationVerdict(input: {
    nodeId: string;
    sessionId: string;
    sessionName: string;
    observation: Exclude<PaneBindingObservation, {
        ok: true;
    }>;
    observedAt?: string;
}): SeatIdentityVerdict;
//# sourceMappingURL=pane-binding-observation.d.ts.map