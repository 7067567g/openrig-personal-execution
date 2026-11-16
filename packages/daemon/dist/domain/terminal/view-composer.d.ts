import type { HostEntry } from "../hosts/hosts-registry-reader.js";
import type { ComposedPane, ComposedView } from "./terminal-provider.js";
/**
 * Default panes per grid page (3×3), used when a provider declares no page size
 * of its own (cmux). Herdr declares 16 (4×4). Overflow spills to the next
 * provider tab/page. A future per-rig `terminal.tiles_per_page` config key is the
 * natural seam for a layout choice; no config key ships here.
 */
export declare const PANES_PER_PAGE = 9;
/**
 * One resolved member of a view, ready to compose. `alive` and `readOnly` are
 * decided upstream (liveness probe + cross-rig/saved-read-only policy); the
 * composer only routes on them. `host` is a structured host id or null (local).
 */
export interface ViewMemberInput {
    /** Canonical session name of the seat. */
    seat: string;
    /** Runtime recorded for a live seat; absent for saved members without inventory data. */
    runtime?: string | null;
    /** Pane label — `<agent> · <slice>` (AC-7). */
    label: string;
    /** The tmux session to attach to (may be null if the seat has no tmux binding). */
    tmuxSession: string | null;
    /** Structured host id when remote; null for a local seat. */
    host: string | null;
    /** View-only / cross-rig membership → read-only (`-r`) attach. */
    readOnly: boolean;
    /** Local liveness (has-session). Ignored for remote members (reachability is an ssh concern). */
    alive: boolean;
}
/** The composer's only side-channel: read-only host resolution from the registry. */
export interface ComposeContext {
    /** Resolve a host id to its registry entry, or null if the id is unknown. */
    resolveHost(id: string): HostEntry | null;
    /** Panes per page for the target provider; defaults to PANES_PER_PAGE. */
    panesPerPage?: number;
    /**
     * Absolute path of the tmux executable the daemon resolves. Used only for LOCAL panes, so a
     * provider started with a narrower PATH can still run the attach (#707). Absent → the bare
     * `tmux` token, unchanged. Never put into an ssh remote command: that host resolves its own.
     */
    localTmux?: string;
    /**
     * The daemon's tmux server flags (`-L <name>` or `-S <path>`), for LOCAL panes only. The daemon's
     * sessions live on the server its inherited $TMUX names, which a new terminal doesn't reach by
     * default. Absent or empty → no flags, unchanged. Never put into an ssh remote command.
     */
    localTmuxServer?: readonly string[];
}
/** Chunk panes into fixed-size grid pages (one provider tab per page). */
export declare function chunkPanes(panes: ComposedPane[], perPage?: number): ComposedPane[][];
/**
 * Compose a resolved member list into a provider-neutral view. Pure: same
 * inputs → byte-identical output. Member order is preserved into `opened`
 * (and therefore into page assignment), so paging is deterministic.
 */
export declare function composeView(id: string, members: ViewMemberInput[], ctx: ComposeContext): ComposedView;
//# sourceMappingURL=view-composer.d.ts.map