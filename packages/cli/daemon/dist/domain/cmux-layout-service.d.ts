import type { CmuxAdapter, CmuxResult } from "../adapters/cmux.js";
export declare const MAX_COLS = 2;
export declare const MAX_PER_WORKSPACE = 12;
export declare const OP_DELAY_MS = 500;
export declare const FINAL_SETTLE_MS = 1000;
export declare const LIST_SURFACES_RETRY_DELAY_MS = 100;
export declare const LIST_SURFACES_MAX_ATTEMPTS = 5;
export declare const EQUALIZE_PASSES = 2;
export declare const EQUALIZE_SETTLE_MS = 1200;
export type SleepFn = (ms: number) => Promise<void>;
/**
 * The modal Auto-grid column count for N panes. MUST mirror the UI's
 * TerminalLauncher `suggestLayout` (PM ruling: the applied cmux grid matches
 * the modal preview — N=7 → 3×3, never 2×4). Kept here because the daemon
 * cannot import from packages/ui; a drift is a bug in whichever side changed.
 */
export declare function autoGridCols(n: number): number;
export interface LayoutShape {
    rows: number;
    cols: number;
    blanks: number;
}
export interface BuildWorkspaceResult {
    workspaceId: string;
    workspaceName: string;
    agents: string[];
    blanks: number;
}
export interface BuildWorkspacePanesResult {
    workspaceId: string;
    workspaceName: string;
    paneCount: number;
    blanks: number;
    /**
     * Observability only — NOT the acceptance signal (VM-proven: cmux can
     * report equalized:true while later layout churn restores binary sizes;
     * final pane frames are the acceptance). True = at least one equalize pass
     * reported a rebalance; false = no pass did. Absent = not applicable
     * (no equalize needed for this shape).
     */
    equalized?: boolean;
}
export interface RigSpecLike {
    pods?: Array<{
        id: string;
        members?: Array<{
            id: string;
        }>;
    }>;
}
export interface CmuxLayoutServiceOptions {
    sleep?: SleepFn;
}
export declare class CmuxLayoutService {
    private cmuxAdapter;
    private readonly sleep;
    constructor(cmuxAdapter: CmuxAdapter, opts?: CmuxLayoutServiceOptions);
    static computeLayout(n: number): LayoutShape;
    /** Grid shape for N panes at an explicit column count (clamped to N). */
    static computeGridLayout(n: number, cols: number): LayoutShape;
    static chunkAgents<T>(agents: T[]): T[][];
    static orderAgentsFromRigSpec(rigSpec: RigSpecLike): string[];
    buildWorkspace(workspaceName: string, cwd: string | undefined, agentSessions: string[]): Promise<CmuxResult<BuildWorkspaceResult>>;
    /**
     * Command-level grid builder (the shared core). Same one-workspace grid as
     * buildWorkspace, but each pane runs an arbitrary caller-composed shell
     * command verbatim (+ trailing newline) — the terminal-provider ride's
     * `paneCommand` contract (read-only `-r`, ssh-wrap, quoting preserved).
     *
     * `cols` overrides the column count (the terminal launcher passes the modal
     * Auto-grid `autoGridCols(N)` — PM ruling: the applied grid must match the
     * modal preview). Omitted → the legacy 2-column rig-launch shape.
     */
    buildWorkspacePanes(workspaceName: string, cwd: string | undefined, paneCommands: string[], cols?: number): Promise<CmuxResult<BuildWorkspacePanesResult>>;
    private discoverInitialSurface;
}
//# sourceMappingURL=cmux-layout-service.d.ts.map