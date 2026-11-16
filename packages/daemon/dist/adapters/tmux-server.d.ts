/**
 * The tmux server flags for an environment. `-L <name>` and the bare form resolve under the attaching
 * terminal's own TMUX_TMPDIR, so they're used only for tmux's standard directory (`/tmp/tmux-<uid>`)
 * with no custom TMUX_TMPDIR in play: nothing for its `default` socket, `-L <name>` for another.
 * Every other socket is named by its path, `-S <path>`. Outside tmux (no $TMUX), nothing: the daemon
 * shares the TMUX_TMPDIR of the shell that started it, so the default form stays as it was.
 */
export declare function tmuxServerArgs(env: NodeJS.ProcessEnv, uid?: number | undefined): string[];
/** Recorded once at daemon startup, from the daemon's own environment. */
export declare function setDaemonTmuxServer(args: readonly string[]): void;
/** The daemon's tmux server flags; empty for the default server. */
export declare function daemonTmuxServerArgs(): readonly string[];
/** `tmux attach -t <session>`, with the daemon's server flags when it isn't on the default server. */
export declare function tmuxAttachCommand(session: string): string;
//# sourceMappingURL=tmux-server.d.ts.map