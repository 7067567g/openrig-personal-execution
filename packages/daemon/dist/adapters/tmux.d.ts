import { type SeatDeliveryGuard } from "../domain/seat-delivery-guard.js";
export type ExecFn = (cmd: string) => Promise<string>;
interface TmuxShellCommandOptions {
    /** Pi can send commands within the terminal byte bound directly. */
    stageIfLong?: boolean;
    /** A staged single-executable runner must replace the staging shell. */
    execInScript?: boolean;
    /** Preserve rc aliases/functions in POSIX or fish panes; other shells use /bin/sh. */
    sourceInPane?: boolean;
}
/**
 * Argv exec: run the multiplexer WITHOUT a shell (execFile-style — the
 * binary is argv[0], the rest are verbatim arguments, no quoting layer).
 * The daemon wires it on every platform: no shell process per call, and on
 * Windows/psmux no POSIX quoting or `/dev/null` redirections to depend on.
 * When absent every method uses the legacy shell-string path unchanged.
 */
export type ArgvExecFn = (argv: string[]) => Promise<string>;
/**
 * Injectable file/buffer operations for `sendText`.
 * Split out so tests can observe temp-file writes and unique-name generation
 * without touching the real filesystem; production wires node fs + os.tmpdir.
 */
export interface TmuxFileOps {
    writeFile(path: string, content: string, options?: {
        mode: number;
        flag: "wx";
    }): Promise<void>;
    unlink(path: string): Promise<void>;
    /** Unique temp-file path per call - parallel `rig up` stands up many seats. */
    tmpName(): string;
    /** Unique tmux buffer name per call - a fixed name would collide under concurrency. */
    bufferName(): string;
}
/** Whether `path` names a launch script sendShellCommand staged (an absolute path with the name
 *  defaultTmuxFileOps gives it). The script removes itself first, so this is a name check only. */
export declare function isStagedSendScriptPath(path: string): boolean;
export declare function defaultTmuxFileOps(): TmuxFileOps;
export type TmuxResult = {
    ok: true;
    warnings?: string[];
} | {
    ok: false;
    code: string;
    message: string;
};
export interface TmuxSession {
    name: string;
    windows: number;
    created: string;
    attached: boolean;
}
export interface TmuxWindow {
    index: number;
    name: string;
    panes: number;
    active: boolean;
}
export interface TmuxPane {
    id: string;
    index: number;
    cwd: string;
    width: number;
    height: number;
    active: boolean;
}
/**
 * Cursor coordinates plus pane geometry, used by the live-terminal seed
 * (OPR.0.4.0.38). Coordinates are zero-based; geometry is the visible pane
 * size. Lifted from the FR-4 seed work so a new subscriber can paint the
 * current screen with the cursor in the right place and no row drift.
 */
export interface TmuxCursorPosition {
    x: number;
    y: number;
    width: number;
    height: number;
}
/**
 * An attached tmux client — the human's terminal/CMUX tile. `name` is the
 * client identifier accepted by `switch-client -c` (the client tty by default);
 * `session` is the session the client is CURRENTLY viewing (may be the wrong or
 * a dead view, which is exactly the recovery case OPR.0.4.3.26 retargets).
 */
export interface TmuxClient {
    name: string;
    session: string;
}
/**
 * Result of a classified session probe (OPR.0.5.4.2). `absent` carries
 * positive tmux evidence; `transport_unavailable` means the tmux server could
 * not be reached and session existence was NOT determined — the two are never
 * interchangeable.
 */
export type SessionProbe = {
    state: "present";
} | {
    state: "absent";
} | {
    state: "transport_unavailable";
    cause: string;
};
/** Shell-quote a string using single quotes (POSIX-safe). */
/** One pane's text from a batched capture, with the time its chunk was read (#309 review). `text` is null for a
 *  session that is gone or an empty capture. */
export interface PaneCapture {
    text: string | null;
    capturedAt: Date; /** The listing lacked the session. */
    missing?: true;
}
/** The most sessions one batched capture chains (#308). Not a byte bound: a chunk whose output overflows exec's buffer
 *  fails and is split in half. */
export declare const CAPTURE_BATCH = 24;
export declare class TmuxAdapter {
    private exec;
    private fileOps;
    private argvExec?;
    deliveryGuard?: SeatDeliveryGuard;
    private readonly freshProbes;
    private readonly freshManaged;
    /** Only the private metadata probe uses this door. Success proves allocation,
     * never authority over a pre-existing or registry-managed target. */
    createProbeSession(name: string, cwd?: string): Promise<TmuxResult>;
    /** #188: kill the session this adapter created only while its id still names that session. tmux checks
     *  the name and creation time and kills in one command, so a later server that reuses the id is safe. */
    private removeCreatedSession;
    private guardedInput;
    /** Explicit internal human input; transport HTTP options cannot select this. */
    humanInput<T>(target: string, fn: () => Promise<T>): Promise<T>;
    operation<T>(target: string, fn: () => Promise<T>): Promise<T>;
    constructor(exec: ExecFn, fileOps?: TmuxFileOps, argvExec?: ArgvExecFn | undefined);
    /**
     * Run a multiplexer command. `argv` is what is EXECUTED on both paths:
     * elements are verbatim (no quoting layer) when argvExec is wired;
     * otherwise they are POSIX-joined — byte-identical to the legacy
     * template strings for all current call sites (the suite pins them).
     * `legacy` overrides the joined form only where history quoted
     * differently (the `-F "..."` double-quoted formats); pass it ONLY to
     * preserve an exact legacy string, never to smuggle new semantics.
     */
    private run;
    /** Ends the daemon's tmux control client, and with it its session (tmux-control.ts), when tmux is driven through one. */
    closeControlClient(): Promise<void>;
    /** Start an empty native terminal server, without inventing a seat/session. */
    startServer(): Promise<TmuxResult>;
    listSessions(): Promise<TmuxSession[]>;
    listWindows(sessionName: string): Promise<TmuxWindow[]>;
    listPanes(target: string): Promise<TmuxPane[]>;
    /**
     * Classified session probe (OPR.0.5.4.2): the three error classes tmux
     * produces are distinct answers, and the adapter must not decide for its
     * callers that a transport failure means absence.
     * - `absent` requires POSITIVE tmux evidence (the can't-find-session class).
     * - `transport_unavailable` is the no-server / socket-gone class: whether
     *   the session exists was NOT determined.
     * - Unexpected probe failures (permission denied, etc.) rethrow so callers
     *   fail closed rather than treating a probe failure as an answer.
     */
    probeSession(name: string): Promise<SessionProbe>;
    /**
     * Collapsed presence view. Kept for the consumers outside the bound
     * send/capture/nudge/walk resolution path (OPR.0.5.4.2 mini-req 6 — their
     * adoption of the classification is a named follow-on). Callers that must
     * distinguish a transport blip from absence use probeSession().
     */
    hasSession(name: string): Promise<boolean>;
    createSession(name: string, cwd?: string, env?: Record<string, string>): Promise<TmuxResult>;
    /** The committed binding now owns identity; this is not filesystem cleanup. */
    finishLaunchBinding(session: string): void;
    private createSessionUnchecked;
    /** Mark the server's inherited parent-session identity as removed in one
     * session's environment, never the server's global one. Explicit seat
     * values stay. Returns whether anything was marked. Throws when the global
     * environment can't be read: the caller can't tell whether the seat inherits
     * an identity, so it reports a warning (the launch still goes ahead). */
    private excludeParentSessionEnv;
    /**
     * Bracketed paste by default, at every size. Unbracketed input can be consumed as individual
     * keystrokes by agent TUIs, losing text even below the old 8 KiB cutoff.
     * A file keeps payload bytes out of shell/tmux argv and its size limits.
     *   `-p`  bracket the paste when the receiving application enables that mode.
     *   `-r`  preserve raw LF. tmux's default paste-buffer replaces every LF with
     *         CR, and CR is SUBMIT in the Claude/Codex TUIs - a
     *         default paste of a multi-line pack would submit on every newline.
     *   `-d`  drop the buffer after a successful paste.
     * `options.bracketed: false` omits `-p` for explicit prompt answers: bytes
     * then act as keystrokes, including menu shortcuts and control keys.
     * Any trailing submit stays the caller's separate `sendKeys(["Enter"])`.
     * Cleanup unlinks the temp file in `finally`; if the buffer was loaded but the
     * paste failed (e.g. missing target), an explicit `delete-buffer` runs so no
     * buffer leaks. Unique temp + buffer names per call keep parallel `rig up`
     * seats from colliding.
     */
    sendText(target: string, text: string, beforeInput?: () => void, options?: {
        bracketed?: boolean;
    }): Promise<TmuxResult>;
    private sendTextUnchecked;
    /**
     * Launch a POSIX command in an empty shell. A newly created pane can still
     * be in canonical input mode: on macOS it silently drops input beyond 1024
     * bytes, even when paste-buffer succeeds. Only a short invocation crosses
     * that boundary; the command's PATH, quoting and arguments travel in a file.
     * The shell removes its private script when consumed (not when pasted).
     * A shell that never consumes the invocation leaves the file for diagnosis.
     */
    sendShellCommand(target: string, command: string, beforeInput?: () => void, options?: TmuxShellCommandOptions): Promise<TmuxResult>;
    /** Stage or send a launch while leaving a consumed script's cleanup to the receiving shell. */
    private sendShellCommandUnchecked;
    sendKeys(target: string, keys: string[], beforeInput?: () => void): Promise<TmuxResult>;
    private sendKeysUnchecked;
    setWindowOption(target: string, option: string, value: string): Promise<TmuxResult>;
    resizeWindow(target: string, cols: number, rows: number): Promise<TmuxResult>;
    killSession(name: string): Promise<TmuxResult>;
    private killSessionUnchecked;
    /** Seat-handover cutover (plan 411c43de): respawn a pane IN PLACE (reuse the retiree's EXACT pane) so
     *  the successor boots below the predecessor's history — same window, same pane, predecessor scrollback
     *  PRESERVED above the boot. The command is shell-quoted as ONE unit (tmux runs it via the shell).
     *
     *  ⚠ NO `-k`: empirically (tmux 3.6a) `respawn-pane -k` force-kills+respawns atomically and CLEARS the
     *  pane's scrollback — defeating the money-proof. So the cutover terminates the retiree FIRST (graceful
     *  exit + `setRemainOnExit(true)` so the pane survives dead), waits for `isPaneDead`, then calls this
     *  WITHOUT -k on the already-dead pane — which preserves the history. respawn-pane refuses a still-live
     *  pane ("still active"), which is the correct guard: never respawn over a live retiree.
     *
     *  Optional `cwd`/`env` inject the successor's start-directory + OpenRig identity env onto the reused
     *  pane via respawn-pane's `-c`/`-e` flags (tmux ≥3.0), the SAME mechanism createSession uses. Any flags
     *  precede the command, which always stays LAST.
     *
     *  ⚠ KI-14: omitting `command` re-runs the pane's CREATION (or last-respawn) command — which is the
     *  default shell ONLY for panes createSession made. Adopted/hand-recovered panes can carry a full
     *  harness invocation there (`codex … resume <old-token>`), so an undefined respawn silently boots the
     *  OLD context. Callers that need a blank pane must pass an explicit shell (see getDefaultShell). */
    respawnPane(paneTarget: string, command?: string, opts?: {
        cwd?: string;
        env?: Record<string, string>;
    }): Promise<TmuxResult>;
    private respawnPaneUnchecked;
    /** Seat-handover cutover: set the pane-scoped `remain-on-exit` so the pane SURVIVES (goes dead, not
     *  destroyed) when the retiree process exits — holding its scrollback for the successor's respawn.
     *  Set to `on` BEFORE the retiree is signalled to exit (else the pane is destroyed on exit and there
     *  is nothing to respawn into). */
    setRemainOnExit(paneTarget: string, on: boolean): Promise<TmuxResult>;
    /** The pane's OWN value for an option, without inherited window/global values: the string, null when the
     *  pane sets none, undefined when tmux could not be read. A caller that changes the option for a while
     *  restores exactly this with restorePaneOption. */
    getPaneLocalOption(paneTarget: string, option: string): Promise<string | null | undefined>;
    /** Put back what getPaneLocalOption read: set the value, or unset the pane's own value when it had none. */
    restorePaneOption(paneTarget: string, option: string, value: string | null): Promise<TmuxResult>;
    /** The pane's whole text, history and visible screen, with wrapped lines joined. Null when unreadable. */
    capturePaneHistory(paneTarget: string): Promise<string | null>;
    /** Signal one process by pid. signalPaneProcess signals the pane's root, which in a shell-backed pane is
     *  the shell, not the runtime running under it. Unix `kill`, like signalPaneProcess. */
    signalPid(pid: number, signal: "TERM" | "KILL"): Promise<TmuxResult>;
    /** Seat-handover cutover: is the pane's process dead (the retiree exited; the pane held by
     *  remain-on-exit)? A known-missing pane also proves physical cutover; unknown probe errors stay false. */
    isPaneDead(paneId: string): Promise<boolean>;
    /** Seat-handover cutover: signal the pane's foreground process (the retiree) — `TERM` for the graceful
     *  exit-in-place, `KILL` for the bounded-timeout force fallback. Resolves the pane pid then `kill`s it;
     *  an unresolvable pid is a structured, non-throwing failure.
     *  Stays on the shell-string path deliberately: this is a Unix `kill`,
     *  not a multiplexer command (Windows needs taskkill — named follow-up). */
    signalPaneProcess(paneId: string, signal: "TERM" | "KILL"): Promise<TmuxResult>;
    private signalPaneProcessUnchecked;
    /** Get the PID of the foreground process in a pane. Returns null if unavailable. */
    getPanePid(paneId: string): Promise<number | null>;
    /** KI-14: the server's `default-shell` option — what a createSession pane runs when no command is
     *  given. Used to make a respawn EXPLICIT about the blank shell instead of inheriting whatever
     *  command the pane was created with. Returns null if unavailable (caller falls back). */
    getDefaultShell(): Promise<string | null>;
    /** Get the current foreground command in a pane. Returns null if unavailable. */
    getPaneCommand(paneId: string): Promise<string | null>;
    /** Whether a pane is in a mode such as copy mode. tmux reports #{pane_in_mode} as the number of
     *  modes the pane is in, so any count above 0 is in a mode. Returns null if unavailable. */
    isPaneInMode(paneId: string): Promise<boolean | null>;
    /** Leave the pane's current mode (copy mode) with `send-keys -X cancel`, through the same input guard as sendKeys. */
    cancelPaneMode(target: string): Promise<TmuxResult>;
    /** A launch metadata read. Callers must never put credential values in terminal input. */
    getSessionEnv(session: string, key: string): Promise<string | undefined>;
    /** Set one variable in a session's environment: what its next spawned process inherits, not a
     *  running one. Callers that pass a value are putting it on a tmux command line. */
    setSessionEnv(session: string, key: string, value: string): Promise<void>;
    /** Remove one variable from a session's environment, so a process spawned there afterwards
     *  inherits the server's value for it, or none. A name that is the launching session's own
     *  identity in the server's environment (see parent-session-env) is marked removed instead, as a
     *  launch does, so the server's value does not come back. */
    unsetSessionEnv(session: string, key: string): Promise<void>;
    private globalEnvironment;
    /** OPR.0.4.3.28 Part C — usable-presence check for a session-env variable.
     *  Returns whether the var has a nonblank value, NEVER that value, and null
     *  when the session environment cannot be inspected. Listing the environment
     *  distinguishes a genuinely absent var from `tmux show-environment <var>`'s
     *  nonzero lookup exit. */
    hasSessionEnv(sessionName: string, varName: string): Promise<boolean | null>;
    /** Start pipe-pane to capture terminal output to a file. */
    startPipePane(sessionName: string, outputPath: string): Promise<TmuxResult>;
    /** Stop pipe-pane on a session. */
    stopPipePane(sessionName: string): Promise<TmuxResult>;
    /** Capture pane content (last N lines). Returns null if unavailable. */
    /**
     * Capture many sessions' panes with a few tmux calls instead of one per session (#308). A `list-sessions` runs next
     * to the first chained call and is read only when a chain fails: a target it lacks maps to null (as a failed
     * per-target capture) without a fork. The targets are captured in chunks of CAPTURE_BATCH chained commands (a
     * `display-message` marker, then `capture-pane`), each pane's output delimited by a marker unique to the call, so the
     * text equals what `capturePaneContent` returns. Targets are exact (`=<name>:`): no prefix match, and a name with a
     * "." still resolves. tmux stops a chain at its first failing command, so a failed chunk drops the targets the
     * listing lacks (`missing`) and retries, or is split in half (an oversized output, or a session gone since the
     * listing); a single session that still fails is left OUT of the map, and the caller reads it per target. A server
     * gone since the listing maps the chunk to null without a retry. Any other chain error leaves the chunk out, so the
     * caller reads each pane per target, as an unbatched read does. Null when a chain fails because the server is gone
     * or its socket can't be reached, and tmux can't be listed; a chain that fails for another reason while the listing
     * fails too leaves the chunk to per-target reads. Each entry carries the time its own chunk was read (`capturedAt`), so a slow later
     * chunk can't make an earlier capture look fresh.
     */
    capturePanesContent(targets: string[], lines?: number, now?: () => Date): Promise<Map<string, PaneCapture> | null>;
    capturePaneContent(paneId: string, lines?: number, opts?: {
        escapeSequences?: boolean;
        joinWrappedLines?: boolean;
    }): Promise<string | null>;
    /**
     * Capture the currently VISIBLE pane screen (no scrollback). Returns null if
     * unavailable. The live-terminal seed (OPR.0.4.0.38) must use the visible
     * screen, NOT `-S -<lines>` scrollback: scrollback reintroduces the row drift
     * the absolute-paint seed exists to eliminate.
     */
    capturePaneScreen(paneId: string): Promise<string | null>;
    /**
     * Get the current cursor coordinates and pane geometry. Coordinates are
     * zero-based. Returns null if unavailable or if tmux yields non-finite /
     * out-of-range values (x<0, y<0, width<1, height<1) so a bad read never
     * produces a garbage seed.
     */
    getPaneCursorPosition(paneId: string): Promise<TmuxCursorPosition | null>;
    /**
     * Set a SESSION-scoped option via `set-option -t <session>` (OPR.0.4.6.02
     * N1 JSDoc fix, arch): this is the GENERIC session-scope writer — it takes
     * ANY session option, not only `@`-prefixed user options (it is how the
     * launcher sets built-in session options like `mouse` and `status`). For
     * SERVER-scope options use `setServerOption` (`set-option -s`); the two
     * scopes are never crossed (guard b2).
     */
    setSessionOption(sessionName: string, key: string, value: string): Promise<TmuxResult>;
    /**
     * OPR.0.4.6.02 S1 (guard b2): set a SERVER-scoped option via
     * `set-option -s <option> <value>` — the daemon configuring its OWN tmux
     * server (NOT a live-flip of anyone's session). NEVER targets a session
     * (`-t`): server scope and session scope are distinct and never crossed.
     * Used for `set-clipboard` / `copy-command`.
     */
    setServerOption(option: string, value: string): Promise<TmuxResult>;
    /**
     * OPR.0.4.6.02 S1: read a SERVER-scoped option value via
     * `show-options -sv <option>` (the `-s` server-scope reader — mirrors
     * `setServerOption`). Returns null if unset or on error. For tests/proof.
     */
    showServerOption(option: string): Promise<string | null>;
    /** Get a session-scoped user option value. Returns null if not set or error. */
    getSessionOption(sessionName: string, key: string): Promise<string | null>;
    /**
    /**
     * Slice 15 — read the timestamp (Unix epoch seconds) of the last
     * activity on the pane's window. The daemon's SeatActivityService
     * compares this against the configured silence window: if the
     * timestamp is within the window the seat is `terminal-active`,
     * otherwise it's silent past the threshold.
     *
     * Why not `pane_silence_flag`: tmux 3.6a was observed to return a
     * blank value for `#{pane_silence_flag}` during slice 15 dogfood
     * (sticky-alert behavior + version-dependent emit semantics), so
     * we cannot rely on it as the primary signal. `#{window_activity}`
     * is reliably populated (the runtime updates it whenever the
     * window receives output) and is the timestamp the tmux status-line
     * activity indicators use themselves.
     *
     * Returns:
     *   - a Unix-epoch-seconds integer when the runtime exposed the value
     *   - `null` when the target is missing OR the value is unparseable
     *     (consumers treat null as "no signal", distinct from "idle").
     */
    /** readAllSessionWindowActivity with a key of each current window's active pane from the same call. tmux changes
     *  what a capture returns without counting activity on a resize, a reset, a respawn, a pane switch or a
     *  clear-history; each moves the pane's id, pid, size, history size or bytes, or its cursor. The session name stays last. */
    readAllSessionWindows(): Promise<Map<string, {
        activity: number;
        size: string;
    }> | null>;
    /** Every session's current-window `#{window_activity}` in ONE tmux call, keyed by session name: the same value
     *  `readPaneLastActivity(<session name>)` reads (display-message -t <session> resolves to the session's current
     *  window). Only well-formed timestamps are included, so a missing key means "read it the per-target way". Null when
     *  tmux can't be read at all. The session name is the LAST field, so a separator inside it stays intact. */
    readAllSessionWindowActivity(): Promise<Map<string, number> | null>;
    /** Every pane's pid and current command in ONE tmux call, keyed by pane id (%N): the values `getPanePid` /
     *  `getPaneCommand` read per pane. Panes without a valid pid are left out (read those per pane). Null when tmux can't
     *  be read at all. The command is the LAST field, so a separator inside it stays intact. */
    readAllPaneProcesses(): Promise<Map<string, {
        pid: number;
        command: string | null;
    }> | null>;
    readPaneLastActivity(paneId: string): Promise<number | null>;
    /**
     * OPR.0.4.3.26 — list the tmux clients (human terminals / CMUX tiles) attached
     * to the server. VIEW-ONLY probe: it never mutates routing, bindings, or
     * sessions. Mirrors the read/parse/error-swallow shape of `listSessions`:
     * a "no server running" / socket-absent server yields `[]` (no attachable
     * client) so the caller emits an honest "attach first" error rather than
     * crashing. Unexpected failures (permission, etc.) rethrow.
     */
    listClients(): Promise<TmuxClient[]>;
    /**
     * OPR.0.4.3.26 — retarget an already-attached client's VIEW to `target`
     * (`<session>` or `<session>:<window>`). This is the whole point of the
     * seat-recovery slice: it changes only what a client SEES; it never creates,
     * kills, or rebinds a session and never touches OpenRig routing/identity.
     */
    switchClient(client: string, target: string): Promise<TmuxResult>;
}
export {};
//# sourceMappingURL=tmux.d.ts.map