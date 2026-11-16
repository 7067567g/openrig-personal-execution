import type { TmuxAdapter } from "../adapters/tmux.js";
/** A single pane observed during a scan */
export interface ScannedPane {
    tmuxSession: string;
    tmuxWindow: string;
    tmuxPane: string;
    pid: number | null;
    cwd: string | null;
    activeCommand: string | null;
}
/** Result of a full tmux scan */
export interface ScanResult {
    panes: ScannedPane[];
    scannedAt: string;
}
/**
 * Enumerates all tmux sessions/windows/panes and resolves PID, cwd,
 * and active foreground command per pane. Uses TmuxAdapter — no raw
 * tmux CLI strings in domain code.
 */
export declare class TmuxDiscoveryScanner {
    private tmux;
    constructor(deps: {
        tmuxAdapter: TmuxAdapter;
    });
    /** Scan all tmux panes and resolve metadata. */
    scan(): Promise<ScanResult>;
}
//# sourceMappingURL=tmux-discovery-scanner.d.ts.map