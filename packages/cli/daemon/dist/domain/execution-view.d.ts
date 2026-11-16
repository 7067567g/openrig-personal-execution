import type Database from "better-sqlite3";
import { type BuildInfo } from "../build-info.js";
export declare const INDETERMINATE: "INDETERMINATE";
export type Indeterminate = typeof INDETERMINATE;
export interface ExecutionViewDeps {
    db: Database.Database;
    /** The missions root (workspace.slices_root). Null => fs-derived sections floor
     *  to INDETERMINATE; the queue-derived sections still answer. */
    slicesRoot: () => string | null;
    /** THE one activity oracle (S19 locked contract): SeatActivityService's
     *  ARBITRATED seat-keyed read — the same source rig ps, node inventory, and
     *  parked-query consume. The vocabulary (working | idle-at-prompt | unknown)
     *  and the separate needsInput {count, reason} pass through UNTRANSLATED —
     *  this module never re-arbitrates. sessions.status and the parallel
     *  AgentActivityStore ingest are NOT acceptable stand-ins (live specimen:
     *  working lanes labeled `superseded`). Absent => INDETERMINATE floors. */
    seatActivity?: {
        getSeatStateBySession(sessionName: string): {
            activity: "working" | "idle-at-prompt" | "unknown";
            needsInput: {
                count: number;
                reason: string | null;
            };
            decidedBy: string | null;
            changedAt: string;
        } | null;
    };
    now?: () => Date;
    buildInfo?: BuildInfo;
    /** Injectable for tests; synchronous fakes are also accepted. */
    exec?: (cmd: string, args: string[]) => string | Promise<string>;
    /** Injectable rigs root for review-artifact scanning (tests). */
    rigsRoot?: () => string;
}
export declare function buildExecutionView(deps: ExecutionViewDeps, opts?: {
    mission?: string;
    rig?: string;
    project?: string;
}): Promise<Record<string, unknown>>;
//# sourceMappingURL=execution-view.d.ts.map