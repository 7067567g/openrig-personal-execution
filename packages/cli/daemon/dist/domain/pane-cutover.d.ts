import type { TmuxAdapter } from "../adapters/tmux.js";
/** The tmux operations an in-place cutover needs: hold the pane, signal its root process, watch it die. */
export type PaneCutoverTmux = Pick<TmuxAdapter, "setRemainOnExit" | "signalPaneProcess" | "isPaneDead">;
export interface PaneCutoverTiming {
    pollMs: number;
    /** Bounded wait for each phase (TERM, then KILL). */
    timeoutMs: number;
    sleep: (ms: number) => Promise<void>;
}
export type PaneTerminationResult = {
    ok: true;
    path: "graceful" | "forced";
} | {
    ok: false;
    message: string;
};
/**
 * Terminate the pane's root process IN PLACE so a respawn (without -k) can reuse the pane and keep its
 * scrollback. `remain-on-exit` goes on FIRST so the pane survives dead instead of being destroyed; then a
 * graceful TERM, and a bounded-timeout KILL as the degraded fallback. It leaves `remain-on-exit` on: the
 * caller decides when the pane no longer needs holding. Timing alone proves nothing about what the runtime
 * saved before it exited.
 */
export declare function terminatePaneInPlace(tmux: PaneCutoverTmux, paneId: string, timing: PaneCutoverTiming, label?: string): Promise<PaneTerminationResult>;
/** Poll `isPaneDead` up to the bounded timeout (count-bounded so injected no-op sleeps stay fast). */
export declare function waitPaneDead(tmux: Pick<TmuxAdapter, "isPaneDead">, paneId: string, timing: PaneCutoverTiming): Promise<boolean>;
//# sourceMappingURL=pane-cutover.d.ts.map