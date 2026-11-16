import type { TmuxResult, TmuxCursorPosition } from "../adapters/tmux.js";
/**
 * Canonical fixed terminal geometry (FR-7). 90 cols (OPR.0.4.0.39, founder-directed):
 * Claude Code (Ink) + Codex CLI are RESPONSIVE TUIs that reflow to whatever width they
 * are given - they have no required width; 80 is the legacy fallback that users find
 * too narrow, so 90 sits comfortably above the 80 floor while being narrower than 120 so
 * the scaled static/live mirror reads bigger (more legible) in the topology grid cells.
 * 27 rows gives the classic-terminal 1.72:1 landscape shape (90x27 = ~650x378px, matching the canonical 80x24 aspect) (founder: classic terminal rectangle) while staying a workable agent-TUI height; subscribers fit/scroll/pan their
 * viewport but never resize the pane - so multiple viewers cannot shrink the session to
 * the smallest one. MUST stay in sync with the client mirror LIVE_TERMINAL_COLS
 * (packages/ui/.../terminal/terminal-geometry.ts) - the xterm grid must match the pane.
 */
export declare const CANONICAL_COLS = 90;
export declare const CANONICAL_ROWS = 27;
/** A connected viewer of one broker. The route adapts a WebSocket to this. */
export interface TerminalSubscriber {
    send(data: string): void;
    close(code: number, reason: string): void;
}
/**
 * The subset of TmuxAdapter the broker drives. Declared structurally so the
 * broker is unit-testable with a plain mock; the real TmuxAdapter satisfies it.
 */
export interface BrokerTmux {
    humanInput?<T>(name: string, fn: () => Promise<T>): Promise<T>;
    hasSession(name: string): Promise<boolean>;
    setWindowOption(name: string, option: string, value: string): Promise<TmuxResult>;
    resizeWindow(name: string, cols: number, rows: number): Promise<TmuxResult>;
    startPipePane(name: string, outputPath: string): Promise<TmuxResult>;
    stopPipePane(name: string): Promise<TmuxResult>;
    sendKeys(name: string, keys: string[]): Promise<TmuxResult>;
    sendText(name: string, text: string): Promise<TmuxResult>;
    capturePaneScreen(name: string): Promise<string | null>;
    getPaneCursorPosition(name: string): Promise<TmuxCursorPosition | null>;
    /** Capture the last `lines` lines INCLUDING scrollback history (tmux
     *  capture-pane -S -lines). Used for the per-subscriber scroll-back window. */
    capturePaneContent(name: string, lines: number): Promise<string | null>;
}
export interface BrokerOptions {
    /** File-tail poll interval (ms). Default 50. */
    pollMs?: number;
    /** Session-liveness probe interval (ms). Default 2000. */
    livenessMs?: number;
    /** Canonical pane width. Default CANONICAL_COLS (90). */
    cols?: number;
    /** Canonical pane height. Default CANONICAL_ROWS (27). */
    rows?: number;
    /** Bounded size of the recent-output history ring in bytes. Default 64KB. */
    maxHistoryBytes?: number;
    /** Called when the broker has no remaining subscribers (or open failed). */
    onEmpty?: (sessionName: string) => void;
}
/** Client-driven input. There is deliberately NO resize message (FR-7). */
export type TerminalInputMessage = {
    type: "keys";
    keys: string[];
} | {
    type: "text";
    text: string;
};
/** ANSI 1-based absolute cursor move (terminal coords are 1-based; tmux is 0-based). */
export declare function cursorPositionEscape(x: number, y: number): string;
/**
 * Build the cursor-safe seed escape sequence for a captured screen. Each row is
 * painted with an ABSOLUTE cursor move so the client renders the screen at the
 * exact same rows tmux has it - never a relative append that drifts as content
 * scrolls. Normalizes CRLF, drops one trailing print newline, and (when a pane
 * height is known and the capture is taller) keeps only the last `height` rows.
 * Lifted from the FR-4 seed work.
 */
export declare function screenSnapshotEscape(snapshot: string, cursor: {
    x: number;
    y: number;
    height?: number;
} | null): string;
/**
 * Raw pipe output from a full-screen TUI is a repaint stream, not durable
 * scrollback. Replaying cursor-addressed history into a fresh xterm before the
 * current snapshot causes stale prompt/status rows to appear above or under the
 * real screen. Preserve the AC-5 shared-history behavior for plain line output
 * (and simple SGR color), but skip history that contains cursor movement,
 * erase, alternate-screen, OSC, or carriage-return repaint semantics.
 */
export declare function isSafeHistoryReplay(data: string): boolean;
/**
 * One broker per live tmux session. Owns a single pipe-pane and fans its output
 * out to every attached subscriber.
 */
export declare class TerminalSessionBroker {
    readonly sessionName: string;
    private readonly tmux;
    private readonly pollMs;
    private readonly livenessMs;
    private readonly cols;
    private readonly rows;
    private readonly maxHistoryBytes;
    private readonly onEmpty?;
    private readonly subscribers;
    private readonly scrollOffsets;
    private history;
    private historyBytes;
    private outputPath;
    private pipeActive;
    private tailInterval;
    private livenessInterval;
    private lastSize;
    private outputDecoder;
    private inputQueue;
    private openPromise;
    private tailStarted;
    private torndown;
    private lastClose;
    constructor(sessionName: string, tmux: BrokerTmux, opts?: BrokerOptions);
    get subscriberCount(): number;
    /** Current size of the broker-owned history ring in bytes (bounded). */
    get historyByteLength(): number;
    /** The session-scoped pipe output file (one per session). Null until open. */
    get pipeOutputPath(): string | null;
    /**
     * Attach a subscriber. The FIRST subscriber stands up the single pipe-pane
     * (fixed geometry, one outputPath, tail + liveness). Every subscriber - first
     * or later - is seeded with the current screen BEFORE it joins the fanout, so
     * it sees coherent state immediately and does not depend on a resize message.
     */
    attach(sub: TerminalSubscriber): Promise<void>;
    /** Close a subscriber that resumed after teardown, with the remembered reason. */
    private closeTorndown;
    /** Forward client input to tmux, serialized so rapid input keeps order (FR-3). */
    input(msg: TerminalInputMessage): Promise<void>;
    /**
     * OPR.0.4.0.39: per-subscriber scroll-back. `offset` = lines above the live
     * bottom (0 = live). Reads tmux scrollback via capture-pane (READ-ONLY on the
     * pane, so it never disturbs the live view of OTHER subscribers) and paints the
     * windowed history to THIS subscriber. At offset 0 it repaints the current screen
     * and the subscriber rejoins the live fanout.
     */
    scroll(sub: TerminalSubscriber, offset: number): Promise<void>;
    /** Repaint the current visible screen to ONE subscriber (scroll-back to live). */
    private repaintScreen;
    /**
     * Detach a subscriber. The broker SURVIVES while other subscribers remain
     * (FR-6); the LAST detach tears the pipe down and deletes the temp file.
     */
    detach(sub: TerminalSubscriber): void;
    /** Force teardown (used by the registry/route on shutdown and by tests). */
    dispose(): void;
    private openPipe;
    private seed;
    private startTail;
    private fanout;
    /** Append to the bounded ring, dropping oldest chunks past the byte cap. */
    private appendHistory;
    private startLiveness;
    /** FR-5: a dead session closes ALL subscribers honestly - never silent stale-live. */
    private handleSessionDeath;
    private teardown;
    private teardownResources;
    private enqueueInput;
}
/**
 * Daemon-owned registry of brokers keyed by canonical session name. Create the
 * broker on the first subscriber for a session; reuse it for later subscribers
 * (so only one pipe-pane exists per session); evict it when it empties.
 */
export declare class TerminalBrokerRegistry {
    private readonly tmux;
    private readonly opts;
    private readonly brokers;
    constructor(tmux: BrokerTmux, opts?: BrokerOptions);
    get size(): number;
    get(sessionName: string): TerminalSessionBroker | undefined;
    /** Get-or-create the broker for a session, attach the subscriber, return the broker. */
    attach(sessionName: string, sub: TerminalSubscriber): Promise<TerminalSessionBroker>;
}
//# sourceMappingURL=TerminalSessionBroker.d.ts.map