import type Database from "better-sqlite3";
/**
 * S5b (OPR.0.5.4.11) — the running-name guard, the FLOOR against duplicate rig
 * identity: `rig up` on a name whose rig is RUNNING must refuse before any
 * create/launch, because session addresses are name-keyed
 * (`{pod}-{member}@{rig}`) and a second running rig collides tmux names, queue
 * destinations, and transcripts while doubling seat launches on one namespace.
 *
 * RUNNING is derived exactly as the daemon already derives it — the rigs table
 * has no status column; a rig is running iff it has at least one sessions row
 * with status='running' (the classifier-lease liveness derivation,
 * startup.ts; the ps summary running-count uses the same predicate).
 *
 * Deliberately NOT here: global name uniqueness, stopped-generation reuse
 * semantics (plural-aware findRigsByName is load-bearing — a same-name rig
 * whose sessions are all non-running never trips this guard), any schema
 * change. The restore-vs-up name-reuse design is a 0.5.5 intake.
 */
export interface RunningRigIdentity {
    id: string;
    name: string;
    runningSessionCount: number;
}
export type RunningNameGuardVerdict = {
    ok: true;
} | {
    ok: false;
    code: "rig_name_running";
    message: string;
    runningRig: RunningRigIdentity;
};
export interface RunningNameGuardDeps {
    /** The repo's existing plural-aware name lookup (ORDER BY created_at). */
    findRigsByName(name: string): Array<{
        id: string;
        name: string;
    }>;
    /** Count of sessions rows with status='running' belonging to the rig's nodes. */
    countRunningSessions(rigId: string): number;
}
/** The one liveness read, shared by every caller: sessions joined through the
 *  rig's nodes, status='running' — the daemon's existing running-derivation. */
export declare function makeRunningSessionCounter(db: Database.Database): (rigId: string) => number;
/**
 * The ONE guard every instantiator create path calls before `createRig()`.
 * Returns ok when no same-name rig is running (including the all-stopped
 * generations case — reuse proceeds unchanged); otherwise a teaching refusal
 * naming the running rig, what was checked, that nothing was created or
 * launched, and the supported alternatives.
 */
export declare function checkRunningNameGuard(deps: RunningNameGuardDeps, name: string): RunningNameGuardVerdict;
export type StoppedGenerationsVerdict = {
    ok: true;
    rigIds: string[];
} | {
    ok: false;
    rigId: string;
    reason: string;
};
/**
 * #141: before an explicit YAML import creates a replacement generation, find the unarchived same-name
 * generations it may archive. Each must have no running sessions (the guard above) and, for every
 * session name it has used, this daemon's tmux must report positive absence or, on the same socket the
 * launch uses, "no server running". Any other probe result is uncertainty, not absence. This is a
 * generation-management rule for the daemon's own tmux namespace, not proof that no process is alive.
 * `probe` is undefined when the adapter cannot probe; the caller then keeps its existing behavior.
 */
export declare function confirmStoppedGenerations(db: Database.Database, unarchivedRigIds: string[], probe: (sessionName: string) => Promise<{
    state: string;
    cause?: string;
}>): Promise<StoppedGenerationsVerdict>;
//# sourceMappingURL=running-name-guard.d.ts.map