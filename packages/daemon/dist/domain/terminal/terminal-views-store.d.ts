import type { ViewMemberInput } from "./view-composer.js";
/** One persisted member of a saved view. Optionals are omitted-when-absent on write. */
export interface SavedViewMember {
    /** Canonical session name of the seat. */
    seat: string;
    /** Pane label — `<agent> · <slice>`. */
    label?: string;
    /** Structured host id (never a `member@rig@host` string). Omitted for a local seat. */
    host?: string;
    /** The tmux session to attach to. */
    tmuxSession?: string;
    /** View-only / read-only attach. Omitted (defaults false) when not read-only. */
    readOnly?: boolean;
}
export interface SavedView {
    id: string;
    name: string;
    members: SavedViewMember[];
}
export interface TerminalViewsFile {
    version: 1;
    views: SavedView[];
}
export declare class TerminalViewsStore {
    private readonly path;
    constructor(path?: string);
    /** The resolved on-disk path (useful for tests / diagnostics). */
    getPath(): string;
    /**
     * Read-at-launch. An absent file yields the empty set. A malformed file
     * throws (honest — never a silent reset that would discard operator layouts).
     */
    read(): TerminalViewsFile;
    list(): SavedView[];
    get(id: string): SavedView | null;
    /**
     * Persist a SAVED view (upsert by id). Atomic (tmp + rename) and byte-stable.
     * Returns the resulting file. Only accepts `SavedView` — a derived view can
     * never reach disk through this path (A3).
     */
    save(view: SavedView): TerminalViewsFile;
    /** Remove a saved view by id (idempotent). Atomic. */
    remove(id: string): TerminalViewsFile;
    private writeAtomic;
}
/**
 * The minimal structural shape of a live seat row the derived-view mapper
 * needs. Deliberately a subset (not an import of `NodeInventoryEntry`) so this
 * module stays free of the inventory's transitive deps and is trivially
 * testable. Field names match `NodeInventoryEntry`.
 */
export interface LiveSeatRow {
    canonicalSessionName: string | null;
    /** Runtime identity from the live node inventory (for provider-specific agent hints). */
    runtime?: string | null;
    /** "tmux" for tmux-backed seats; other kinds have no attachable pane. */
    attachmentType: string | null;
    /** The tmux session name (canonical session name for tmux-backed seats). */
    tmuxSession?: string | null;
    rigName?: string | null;
    logicalId?: string | null;
}
/** Options controlling how a derived view labels/scopes its members. */
export interface DeriveOptions {
    /** Structured host id to stamp on every derived member (remote scope); omit for local. */
    host?: string | null;
    /** When true, members attach read-only (`-r`) — cross-rig / view-only derived scopes. */
    readOnly?: boolean;
    /** Slice/mission label suffix for the pane label (`<agent> · <slice>`); optional. */
    labelSuffix?: string;
}
/**
 * Map a live seat inventory into composer-ready members. PURE and IN-MEMORY —
 * the result is handed straight to `composeView`; it is NEVER written to the
 * saved-views file. Non-tmux / session-less rows are dropped from the derived
 * set (a derived view only tiles attachable seats; saved views name absents).
 */
export declare function deriveViewMembers(rows: LiveSeatRow[], opts?: DeriveOptions): ViewMemberInput[];
//# sourceMappingURL=terminal-views-store.d.ts.map