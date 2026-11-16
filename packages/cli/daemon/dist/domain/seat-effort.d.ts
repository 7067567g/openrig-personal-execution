import type Database from "better-sqlite3";
/**
 * OPR.0.7.0.7 — one seat's reasoning effort, from the saved choice to what the native session runs.
 *
 * Four values stay distinct: requested (the last `rig seat set-effort`), saved (this resolution),
 * emitted (the flag the running process was launched with) and observed (what the native session
 * records for a turn it took). Only the last one says which effort the model used.
 */
/** What a seat's managed launch sends: its explicit choice, else the authored/default resolution in
 *  nodes.effort, else no flag at all (the runtime's own default). */
export interface EffortResolution {
    choice: string | null;
    authored: string | null;
    effective: string | null;
    source: "seat_choice" | "authored" | "runtime_default";
}
/** The one resolver every managed continuation (fresh, successor, in-place restart) reads. */
export declare function resolveSeatEffort(node: {
    effort?: string | null;
    effortChoice?: string | null;
}): EffortResolution;
/** The seat's resolution from its node row. null: no such node. A database older than the
 *  effort_choice column resolves from nodes.effort alone, as launches did before it existed. */
export declare function readSeatEffort(db: Database.Database, nodeId: string): EffortResolution | null;
/**
 * The precedence rule (OPR.0.7.0.7): what restoring an older snapshot and refreshing the spec do with a
 * seat's saved effort choice. Every such writer asks this one seam; `effortPrecedence` is the rule in force.
 */
export interface EffortPrecedenceRule {
    /** Whether the rule is the decided one (false only for the placeholder kept for comparison). */
    readonly decided: boolean;
    readonly detail: string;
    /** The effort a snapshot restore launches the seat with. `snapshot` is the node as the snapshot
     *  captured it; `live` is the seat's current resolution (null when the node row is gone). */
    restoreLaunchEffort(input: {
        snapshot: {
            effort?: string | null;
            effortChoice?: string | null;
        };
        live: EffortResolution | null;
    }): {
        effort: string | null;
        warning?: string;
    };
    /** Whether a spec refresh keeps or clears the seat's saved choice (it always rewrites the authored value). */
    specRefreshChoice(input: {
        choice: string | null;
        authoredBefore: string | null;
        authoredAfter: string | null;
    }): "keep" | "clear";
}
/** No rule is picked. Each writer keeps what it did before seat choices existed: a restore launches
 *  the snapshot's authored effort and says so when the seat's saved choice differs; a spec refresh
 *  rewrites only the authored value. Neither writes or deletes the saved choice. */
export declare const UNDECIDED_EFFORT_PRECEDENCE: EffortPrecedenceRule;
/**
 * The decided rule: a seat's latest explicit effort choice sticks until cleared, through reboots, team restarts,
 * restores and spec refreshes; clearing returns to the spec's authored effort or the runtime default, and says
 * which. Fresh launches, successors and in-place restarts already resolve the choice first (resolveSeatEffort);
 * this rule covers the two writers that hold older values:
 * - a snapshot restore launches the seat's saved choice when it has one (saying so when the snapshot held another
 *   value); the restore finds the live seat by its logical id, so a seat grown back under a new node id counts. A
 *   seat without a choice (never set, or cleared) launches the snapshot's authored effort as before, so an older
 *   snapshot never brings a cleared choice back. With no live seat (`live` null), the rule answers with the
 *   snapshot's recorded choice, else its authored effort; that answer is rule-only, since restore doesn't
 *   launch a seat that no longer exists;
 * - a spec refresh rewrites the authored value and keeps the choice.
 * No restore option in this version picks older settings deliberately, so every restore keeps the choice.
 */
export declare const LATEST_WINS_EFFORT_PRECEDENCE: EffortPrecedenceRule;
export declare const effortPrecedence: EffortPrecedenceRule;
export type EffortRuntime = "claude-code" | "codex";
/** Levels each runtime is known to accept (Codex 0.153.4's service lists these when it rejects one;
 *  Claude Code's --effort levels). A level outside the list is saved with a warning, never refused:
 *  versions and models move, and the runtime's own answer is what the report shows. */
export declare const KNOWN_EFFORT_LEVELS: Record<EffortRuntime, readonly string[]>;
export declare function unknownLevelWarning(runtime: EffortRuntime, level: string | null): string | undefined;
/** The effort a launch command line carries. "none": parsed, and it sends no effort flag. */
export declare function emittedEffortFromArgv(runtime: EffortRuntime, argv: string[]): {
    flag: "present";
    value: string;
} | {
    flag: "none";
};
/**
 * What the native session recorded is the level its client SENT for a turn; that alone isn't proof
 * the model ran at it (measured: Codex records an unknown level the service then rejects). `outcome`
 * says what is known about that turn:
 * - accepted: Codex's turn completed without an error, so its service took the level;
 * - rejected: the service rejected the request because of this level (its message names the value);
 * - failed: the turn ended in another error (usage limit, unauthorized, other) before the level could be judged;
 * - interrupted: the turn was aborted; not known whether the level was taken;
 * - pending: the turn hasn't finished;
 * - recorded: Claude wrote the level on an answered turn; whether that is the level before or after
 *   a model fallback isn't shown, so it stays unproven as the applied level.
 */
export type NativeEffortObservation = {
    state: "observed";
    value: string;
    at: string;
    source: string;
    outcome: "accepted" | "rejected" | "failed" | "interrupted" | "pending" | "recorded";
    detail?: string;
} | {
    state: "not_verified";
    detail: string;
};
/**
 * The effort the native session recorded for its latest turn since `processStartedAt` (ps lstart):
 * Claude writes it on each assistant entry of its transcript, Codex on each turn_context line of its
 * rollout. A turn before the process started belongs to an earlier launch of the same conversation,
 * so it is never reported as this launch's effort.
 */
export declare function readNativeEffort(runtime: EffortRuntime, transcriptPath: string | null, processStartedAt: string | null): NativeEffortObservation;
//# sourceMappingURL=seat-effort.d.ts.map