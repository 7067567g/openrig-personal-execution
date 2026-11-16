import type Database from "better-sqlite3";
import type { ExecFn } from "../adapters/tmux.js";
import type { ExternalInstallAction } from "./external-install-planner.js";
/** A tagged action with its approval decision */
export interface TaggedAction {
    action: ExternalInstallAction;
    approved: boolean;
}
/** Result of executing a single action */
export interface ExecutionResult {
    actionId: string;
    requirementName: string;
    status: "completed" | "failed" | "skipped";
    command: string | null;
    stdout: string | null;
    errorMessage: string | null;
    durationMs: number;
}
/** Summary of all executed actions */
export interface ExecutionSummary {
    results: ExecutionResult[];
    completed: ExecutionResult[];
    failed: ExecutionResult[];
    skipped: ExecutionResult[];
}
/**
 * Executes approved external install actions via injected ExecFn.
 * Journals everything to bootstrap_actions table.
 * On failure: marks failed, continues to next (no global abort).
 * No automatic uninstall rollback.
 */
export declare class ExternalInstallExecutor {
    private exec;
    readonly db: Database.Database;
    constructor(deps: {
        exec: ExecFn;
        db: Database.Database;
    });
    /**
     * Execute tagged actions. All actions are journaled (including skipped).
     * @param bootstrapId - links journal entries to a bootstrap run
     * @param taggedActions - full action set with approval decisions
     */
    execute(bootstrapId: string, taggedActions: TaggedAction[], startSeq?: number): Promise<ExecutionSummary>;
    private journal;
}
//# sourceMappingURL=external-install-executor.d.ts.map