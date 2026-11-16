import type { ComposedPane, ComposedView, OpenViewResult, ProviderLiveness, ProviderStatus, TerminalProvider } from "./terminal-provider.js";
import type { HerdrResult, HerdrTransport, HerdrTransportFactory } from "./herdr-transport.js";
/** The degrade reason for a seat whose pane was already gone right after its page applied (#707). */
export declare const HERDR_PANE_EXITED_REASON = "the pane had already exited when OpenRig checked right after herdr opened it";
/** The note when the pane listing can't confirm a page's panes; its seats stay listed as opened. */
export declare const HERDR_PANES_UNCONFIRMED_NOTE = "herdr's pane list couldn't confirm the panes after layout, so those seats are listed as opened without that check.";
/**
 * #707 — `layout.apply` acknowledges the tab, not that each pane's command stayed alive. One read of
 * the workspace's panes right after a page applies finds seats whose pane is already gone. There is
 * no wait, so only a pane that exited before this read is seen.
 *
 * It fails safe: a seat is degraded only when the listing positively shows the page's tab, and
 * either another seat's label from the same apply is matched there (so labels compare) or the tab
 * holds nothing but blank filler panes. A missing tab, an empty or unreadable listing, or labels
 * that match nothing keep today's `opened`, with a note.
 */
export declare function exitedSeats(transport: HerdrTransport, workspaceId: string, tabId: string, pagePanes: ComposedPane[], blanks: number, notes: string[]): Promise<Set<string>>;
/** A herdr layout-tree pane leaf — `command` is an ARGV array (capture-verified). */
export interface HerdrPaneNode {
    type: "pane";
    label: string;
    command: string[];
}
/** A herdr layout-tree binary split (capture-verified shape). */
export interface HerdrSplitNode {
    type: "split";
    direction: "right" | "down";
    ratio: number;
    first: HerdrLayoutNode;
    second: HerdrLayoutNode;
}
export type HerdrLayoutNode = HerdrPaneNode | HerdrSplitNode;
/**
 * Combine N nodes into an equal N-way strip along one direction. PURE.
 * Equal N-way BSP is first-vs-rest at ratio 1/N, recursively 1/(N-1) —
 * NOT midpoint 0.5 (the VM-reproduced defect: alternating 0.5 splits gave
 * N=7 a 4×2 layout with one double-width cell instead of the promised 3×3).
 */
export declare function equalStrip(nodes: HerdrLayoutNode[], direction: "right" | "down"): HerdrLayoutNode;
/**
 * Build an equal grid for one page. Explicit columns are capped to its pane
 * count, as in cmux; otherwise use the UI TerminalLauncher `suggestLayout` —
 * cols = ceil(sqrt(N)), rows = ceil(N/cols): N=2 → 2×1, N=5 → 3×2, N=7 → 3×3
 * (cols×rows). An incomplete rectangle is padded with inert blank panes so
 * every cell is the same size; blanks are layout filler only — they are never
 * reported as opened seats. Each real leaf runs the composer's shell
 * `paneCommand` via `["sh","-c",…]` so the composed quoting (read-only `-r`,
 * ssh-wrap) is preserved; a known Claude/Codex runtime adds Herdr's detection
 * hint. Rows are built as equal `right` strips,
 * then combined with equal `down` strips.
 */
export declare function buildGridRoot(panes: ComposedPane[], columns?: number): {
    root: HerdrLayoutNode;
    blanks: number;
    columns: number;
    rows: number;
};
/** The per-page socket request plan — pure, so it is asserted directly in tests. */
export interface HerdrPagePlan {
    /** Fresh tab label for this page (embeds the launch token → fresh-on-relaunch). */
    tabLabel: string;
    /** The whole page's layout tree — ONE atomic layout.apply request body. */
    root: HerdrLayoutNode;
    /** Inert blank leaves padding the grid rectangle (never reported as opened). */
    blanks: number;
}
export interface HerdrLayoutPlan {
    /** The label for the fresh per-open workspace (same token discipline as tabs). */
    workspaceLabel: string;
    pages: HerdrPagePlan[];
}
/** A named view's tab: its panes' names in reading order, such as "dashboard · operator". */
export declare function namedTabLabel(page: ComposedPane[]): string;
/**
 * Build the herdr socket plan for a composed view. PURE — no I/O. Each page
 * gets a fresh tab labeled `${tabPrefix}:${view.id}#<plan>#${launchToken}/<pageIndex>`;
 * two calls with different `launchToken`s produce DIFFERENT labels, which is
 * exactly the fresh-tab-on-relaunch (not-replace) invariant.
 */
export declare function planHerdrLayout(view: ComposedView, launchToken: string, tabPrefix?: string): HerdrLayoutPlan;
/**
 * Extract the created workspace's id from a `workspace.create` result body.
 * The live envelope is VM-confirmed (OPR.0.4.7.1): `result.workspace.
 * workspace_id` + `result.tab.tab_id` + `result.root_pane` — covered by the
 * nested-`workspace` home below. The other defensive homes are retained
 * (top-level `workspace_id`, nested `layout`, bare `id`) for older builds.
 * Returns null when nothing string-shaped is found (the caller degrades
 * honestly rather than guessing).
 */
export declare function extractWorkspaceId(result: HerdrResult): string | null;
export interface HerdrAdapterDeps {
    transportFactory: HerdrTransportFactory;
    launch?: ProviderStatus["launch"];
    /**
     * Mint a fresh launch token per `openView` so a relaunch creates a new tab
     * (BR-5). Injectable for deterministic tests. Default: a per-instance
     * monotonic counter (unique within a daemon lifetime).
     */
    newLaunchToken?: () => string;
    /** Tab-name prefix (default `openrig`). */
    tabPrefix?: string;
}
/** Herdr lays out 4×4 per tab (OPR.0.6.0.8); cmux keeps the composer default. */
export declare const HERDR_PANES_PER_PAGE = 16;
/** A `tab_id` from a herdr result body (`result.tab.tab_id`, `result.layout.tab_id`, or top-level). */
export declare function extractTabId(result: HerdrResult | null | undefined): string | null;
/** Workspace labels from a `workspace.list` result body; [] when the shape is unknown. */
export declare function extractWorkspaceLabels(result: HerdrResult | null | undefined): string[];
export declare class HerdrAdapter implements TerminalProvider {
    private readonly deps;
    readonly name = "herdr";
    readonly panesPerPage = 16;
    private readonly transport;
    private readonly newLaunchToken;
    private readonly tabPrefix;
    private launchCounter;
    constructor(deps: HerdrAdapterDeps);
    status(): Promise<ProviderStatus>;
    liveness(): Promise<ProviderLiveness>;
    openView(view: ComposedView): Promise<OpenViewResult>;
}
//# sourceMappingURL=herdr-adapter.d.ts.map