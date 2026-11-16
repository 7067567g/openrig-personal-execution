/**
 * Enumerates all tmux sessions/windows/panes and resolves PID, cwd,
 * and active foreground command per pane. Uses TmuxAdapter — no raw
 * tmux CLI strings in domain code.
 */
export class TmuxDiscoveryScanner {
    tmux;
    constructor(deps) {
        this.tmux = deps.tmuxAdapter;
    }
    /** Scan all tmux panes and resolve metadata. */
    async scan() {
        const panes = [];
        const scannedAt = new Date().toISOString();
        const sessions = await this.tmux.listSessions();
        for (const session of sessions) {
            // tmux reads a leading "=" in a target as "match this session name
            // exactly", so a session literally named "=lit" must be addressed as
            // "==lit". Prefixing every lookup keeps the name exact and literal:
            // "lit" -> "=lit", "=lit" -> "==lit".
            const exactSession = `=${session.name}`;
            const windows = await this.tmux.listWindows(exactSession);
            for (const window of windows) {
                const target = `${exactSession}:${window.index}`;
                const tmuxPanes = await this.tmux.listPanes(target);
                for (const pane of tmuxPanes) {
                    let pid = null;
                    let activeCommand = null;
                    try {
                        pid = await this.tmux.getPanePid(pane.id);
                    }
                    catch {
                        // Pane metadata lookup failed — continue with null
                    }
                    try {
                        activeCommand = await this.tmux.getPaneCommand(pane.id);
                    }
                    catch {
                        // Pane metadata lookup failed — continue with null
                    }
                    panes.push({
                        tmuxSession: session.name,
                        tmuxWindow: `${window.index}`,
                        tmuxPane: pane.id,
                        pid,
                        cwd: pane.cwd || null,
                        activeCommand,
                    });
                }
            }
        }
        return { panes, scannedAt };
    }
}
//# sourceMappingURL=tmux-discovery-scanner.js.map