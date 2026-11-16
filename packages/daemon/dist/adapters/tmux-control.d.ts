import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { ArgvExecFn } from "./tmux.js";
/**
 * tmux commands over one long-lived control-mode client (`tmux -C`) instead of a new tmux client per command. Opt-in:
 * the daemon drives tmux this way only with OPENRIG_TMUX_CONTROL=1 (startup.ts); without it, every command spawns a
 * client, as before.
 *
 * Each spawned client costs the daemon a fork of its whole process: some 28 ms of CPU a command at its size, against
 * 0.3 ms for a line written to a client already connected. The client makes a session of its own as it attaches
 * (`new-session`: an existing session is never taken over, whatever its name), named after this daemon's owner id and
 * marked with it (`@openrig-control`), and `destroy-unattached`: tmux destroys it when the client leaves, so the daemon
 * never kills a session itself. Listings leave out this daemon's own session and client, and nothing else: a session
 * another daemon or a person made, whatever its name or mark, is listed as any other.
 *
 * What it runs and what it gives back are the spawned client's: the same commands, their output, the same error text
 * in `execStderr`, a chain stopped at its first failing command, and output past TMUX_MAX_BUFFER failed with execFile's
 * `maxBuffer length exceeded`. The differences: a chain's commands are sent one after the other's reply, so another
 * client's command may run between them, which it cannot in a spawned client's chain; a client that ends partway
 * through a chain fails the rest at once, the outcome of the commands it sent unknown, and none is run again; and the
 * blocks tmux's hooks print on their own (an `after-list-panes` in a user's tmux.conf) are not taken for a command's
 * reply, where a spawned client prints a hook's output after its command's. Anything else (a launch,
 * which takes the spawning process's environment; `load-buffer`, see ROUTED; a command line that cannot be written on
 * one line; a global flag; no server yet, or one before 3.2) goes to the spawned client, as before.
 */
/** The session option that marks a control session: its value is the owner id of the daemon whose client made it. */
export declare const CONTROL_OPTION = "@openrig-control";
/** The name a daemon's control session is made with: one of its own on any server. */
export declare function controlSessionName(owner: string): string;
/** The argv's commands, as a spawned tmux reads its arguments (cmd-parse.c): an argument ending in `;` ends its
 *  command and keeps the rest (`abc;` is `abc`, then a new command); one ending in `\;` is kept with a literal `;`
 *  instead (`abc\;` is `abc;`). An empty command is skipped. Each argument is then sent quoted, as it reads. */
export declare function commandsOf(args: string[]): string[][];
/** What starts each row a listing prints for the owner's own session, its windows, panes and client: drawn for each
 *  call, so that no other row (whatever its format prints) and no other command's output starts with it. */
export declare function ownRowTag(): string;
/** The argv with each listing's `-F` format starting its own rows (the owner's session's, and its client's) with `tag`,
 *  which `withoutOwnRows` then drops. No `-f` filter: one needs tmux 3.2 (3.4 for list-clients) of the server, which a
 *  client's own version does not tell. A format is all a row shows, so a listing without `-F` is left as is. */
export declare function markOwnRows(args: string[], owner: string, tag: string): string[];
/** A listing's output without the rows `markOwnRows` marked with `tag`. */
export declare function withoutOwnRows(stdout: string, tag: string): string;
/** Whether tmux's version (`tmux -V`, or a server's `#{version}`) names 3.2 or later: the client flags of
 *  `new-session -f`. */
export declare function supportsControlMode(versionLine: string): boolean;
/** A command's reply: its output lines, none once they went past the bound (`overflow`). */
interface Reply {
    ok: boolean;
    lines: string[];
    overflow: boolean;
}
interface Pending {
    resolve: (reply: Reply) => void;
    reject: (error: Error) => void;
}
/** The replies of one control client, read off its stdout: each command's `%begin` … `%end` (or `%error`) block, in
 *  the order the commands were written. A block ends only on the line that repeats its own `%begin` header, so a pane
 *  line reading `%end …` never ends it. Only a block whose flags (the header's third field) say the client sent the
 *  command answers one: a hook (`after-list-panes` in a user's tmux.conf) prints its own blocks, flagged 0, between
 *  them, and those are no command's reply. A reply keeps at most `maxBytes` of output, as a spawned client's stdout is
 *  bounded (TMUX_MAX_BUFFER): past it, its lines are dropped as they come, up to its end, so every later reply is still
 *  its own command's, and it is answered as overflowed. A line with no end yet is bounded the same way. */
export declare class ControlReplies {
    private readonly maxBytes;
    private partial;
    /** Set while the rest of a line past the bound is dropped, up to its newline. */
    private skipping;
    private header;
    private lines;
    /** The bytes of the block being read, and whether they went past the bound. */
    private bytes;
    private overflow;
    private readonly pending;
    /** The first block answers the client's own `new-session`, before any command was written. */
    private attached;
    /** Set once the client is gone: nothing will be answered any more. */
    private failure;
    /** Called with the outcome of the client's `new-session`: false when it made no session (a name taken). */
    onAttached?: (ok: boolean) => void;
    /** Called after each command's reply. */
    onReply?: () => void;
    /** Called on tmux's `%sessions-changed`: a session was made or destroyed on the server. */
    onSessionsChanged?: () => void;
    constructor(maxBytes?: number);
    get closed(): boolean;
    /** The commands written and not answered yet. */
    get waiting(): number;
    expect(pending: Pending): void;
    push(chunk: string): void;
    /** Drops the block's output once past the bound: only that it overflowed is kept. */
    private overflowed;
    private line;
    /** Fails every command still waiting, and any expected later: the client is gone, so none will be answered. */
    failAll(error: Error): void;
}
/** Starts the control client with these tmux arguments (`spawnTmuxClient`); tests give their own. */
export type SpawnControlClient = (args: string[]) => ChildProcessWithoutNullStreams | Promise<ChildProcessWithoutNullStreams>;
export interface TmuxControlOptions {
    spawnClient?: SpawnControlClient;
    /** Once the command at the head of the line has had no reply for this long, the client is ended: the reads it owed
     *  are asked again of a spawned client, the writes it owed fail, and the next command starts a new client. Also the
     *  time a client has to attach. */
    replyTimeoutMs?: number;
    now?: () => number;
    /** This daemon's id on a tmux server: its control session's name and mark. A random one by default. */
    owner?: string;
    /** The most output a call may give, as a spawned client's stdout is bounded: TMUX_MAX_BUFFER by default. */
    maxBuffer?: number;
}
export type TmuxControlExec = ArgvExecFn & {
    close: () => Promise<void>;
    owner: string;
};
/**
 * The ArgvExecFn the daemon's TmuxAdapter runs with when control mode is on: routed commands go to the control client,
 * every other one, or any while the client cannot run, to `fallback` (the spawned client).
 */
export declare function tmuxControlExec(fallback: ArgvExecFn, options?: TmuxControlOptions): TmuxControlExec;
export {};
//# sourceMappingURL=tmux-control.d.ts.map