import type { RestoreFleetStatus } from "../daemon-client.js";
import type { TriageRow } from "./triage.js";
/** The daemon surface the lifecycle needs — a structural subset of DaemonClient (injectable for tests). */
export interface RestoreLifecycleClient {
    restoreFleet(): Promise<{
        fleetAttemptId: string;
    }>;
    restoreFleetStatus(id: string): Promise<RestoreFleetStatus>;
    cancelRestoreFleet(id: string): Promise<unknown>;
}
/** One rendered frame of the lifecycle — a poll's status plus the retained attempt id + phase.
 *  `detached` = the driver stopped polling (poll ceiling reached, or repeated poll errors) while the
 *  restore is STILL running on the daemon — an explicit, operable state (reattach / cancel by id), NEVER
 *  a frozen `running` screen with a dead cancel key. */
export interface RestoreFrame extends RestoreFleetStatus {
    attemptId: string;
    phase: "running" | "done" | "detached";
}
/** Per-rig progress row for the running view (one per rig in the rollup sequence so far). */
export interface RestoreProgressRow {
    rigId: string;
    outcome: string;
}
/** The render model for the restore lifecycle surface — progress while running, rollup + the
 *  keyboard-walkable triage list when done. Built purely from a frame so the render stays testable. */
export interface RestoreLifecycleVM {
    phase: "running" | "done" | "detached";
    cancelled: boolean;
    verdict: string;
    counts: RestoreFleetStatus["rollup"]["counts"];
    progress: RestoreProgressRow[];
    /** The triage list (attention seats + not_attempted rigs) as shipped TriageRow[] — fed to renderTriage. */
    triage: TriageRow[];
    /** The retained attempt id — the detached view needs it for the reattach / direct-cancel affordances. */
    attemptId: string;
}
/** Adapt a lifecycle frame into the render VM. The triage list is the UNION of two honest sources,
 *  each carrying its EXACT need on its own row (never a clipped one-line summary): the per-seat
 *  attention rows (Claude picker / Codex auth / awaiting-decision), red; and the not_attempted rigs
 *  that carry a remediation (no usable snapshot / cancelled), yellow (a caveat, not a failed seat). */
export declare function buildRestoreLifecycleVM(frame: RestoreFrame): RestoreLifecycleVM;
export interface RestoreLifecycleDeps {
    client: RestoreLifecycleClient;
    /** Called with EVERY poll (running + detached frames included) — the progress stream the TUI renders. */
    onFrame: (frame: RestoreFrame) => void;
    /** Polled each tick; when true, the driver POSTs cancel once (stop-before-next-rig). */
    isCancelRequested: () => boolean;
    /** Reattach to an EXISTING attempt (skip the kick) — the detached view's `r` re-enters the loop. */
    attemptId?: string;
    /** Injected in tests (no real delay); production uses setTimeout. */
    sleep?: (ms: number) => Promise<void>;
    pollIntervalMs?: number;
    maxPolls?: number;
    /** Consecutive poll ERRORS tolerated before detaching (a transient blip must NOT kill the driver). */
    maxConsecutiveErrors?: number;
}
/** Drive one fleet restore from the TUI: kick (or reattach), retain the attempt id, poll emitting a
 *  frame each time (mid-run observable), request cancel when the operator asks, resolve on done. Two
 *  guarantees the operator lifecycle depends on:
 *   - a TRANSIENT poll error never ends the lifecycle — it is tolerated and retried; only
 *     `maxConsecutiveErrors` in a row (a genuinely unreachable daemon) DETACHES.
 *   - reaching the poll ceiling DETACHES (phase "detached"), it does NOT return a frozen "running"
 *     frame — so the caller never renders a live-looking screen whose cancel key is dead. A detached
 *     frame is an explicit, operable state: the caller reattaches or cancels by the retained id. */
export declare function driveRestoreLifecycle(deps: RestoreLifecycleDeps): Promise<RestoreFrame>;
//# sourceMappingURL=restore-lifecycle.d.ts.map