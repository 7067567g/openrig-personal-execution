import { type StartupState } from "./startup.js";
import type { RestoreLifecycleVM } from "./crash-cart/restore-lifecycle.js";
import type { CrashCartModel } from "./crash-cart/crash-cart-model.js";
import type { DaemonState, DaemonUnverifiedEvidence } from "./crash-cart/contract.js";
import type { ColorMode } from "./theme.js";
import type { FleetSnapshot, LoadState, RowFlash, Screen, ViewState } from "./types.js";
export interface RenderOptions {
    /** Independent endpoint chosen for a standalone TUI after a collision. */
    controlSocketPath?: string;
    /** First visit: preserve the prior frame with its original label and no effect targets. */
    previousPage?: {
        state: ViewState;
        snapshot: FleetSnapshot;
    };
    startup?: StartupState;
    /** I5 — the live command context (from the C3 detector); default "standard". */
    commandContext?: string;
    completion?: {
        candidates: string[];
        message: string;
    } | null;
    cols?: number;
    rows?: number;
    /** wall-clock ms for time-driven motion (spinner frames, flash windows);
     * renderScreen stays pure — the caller supplies time (round-4 wiring) */
    nowMs?: number;
    /** the active Style's color mode — picks braille vs line spinner frames */
    colorMode?: ColorMode;
    /** S19 round-5 (guard): the refresh owner's honest load lifecycle — the
     * spinner renders ONLY while un-settled/in-flight; omitted = settled
     * (demo/fixtures: the data given IS the answer, nothing is loading) */
    load?: LoadState;
    /** S19 round-5 (guard): per-seat fresh pane-output events from the refresh
     * owner — renderScreen targets each agent's explorer row while its one-shot
     * window is open; omitted = no flashes */
    rowFlashes?: RowFlash[];
    /** 5.2 crash-cart: the resolved daemon-down signal. Present ⇒ the whole screen is the daemon-down
     *  path — the normal fleet views have no data when the daemon isn't serving. */
    daemonState?: DaemonState;
    unavailable?: string;
    unavailableExpanded?: boolean;
    starting?: string;
    /** the cockpit model — rendered when daemonState === "down". */
    crashCart?: CrashCartModel;
    /** evidence for the UNVERIFIED screen — rendered when daemonState === "unverified". */
    daemonEvidence?: DaemonUnverifiedEvidence;
    /** B1 ROUND 2 — the live fleet-restore lifecycle; when present it renders (progress → rollup+triage)
     *  and takes precedence over the cockpit, so restore progress and the triage list are visible. */
    restore?: RestoreLifecycleVM;
    /** B1 ROUND 3 (HIGH-2) — vertical scroll offset into the restore content, so a triage list longer
     *  than the viewport stays keyboard-walkable (the shell reports contentMaxOffset for clamping). */
    restoreScroll?: number;
    /** B1 ROUND 10 — the ⏎ confirm banner text (non-zero-generation restore). Rendered IN the cockpit so
     *  the confirm is visible where the operator looks (ViewState.notice is not shown in the cockpit). */
    confirm?: string;
}
export declare function renderScreen(state: ViewState, snap: FleetSnapshot, options?: RenderOptions, inputLine?: string): Screen;
//# sourceMappingURL=render.d.ts.map