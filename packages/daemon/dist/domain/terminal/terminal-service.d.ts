import { buildGridRoot } from "./herdr-adapter.js";
import type { LiveSeatRow, SavedView, TerminalViewsStore } from "./terminal-views-store.js";
import type { HostEntry } from "../hosts/hosts-registry-reader.js";
import type { OpenViewResult, ComposedView, ProviderLiveness, ProviderStatus, TerminalProvider } from "./terminal-provider.js";
/** The v1 provider name set (herdr = proof-gated primary; cmux = best-effort). */
export type TerminalProviderName = "herdr" | "cmux";
export declare const DEFAULT_PROVIDER: TerminalProviderName;
export interface OpenViewRequest {
    /** Provider name. Omitted: the first of herdr, then cmux, that is available and alive; herdr when neither is. */
    provider?: string;
    /** The view argument: a rig name | `mission:<id>` | `slice:<id>` | a saved-view id. */
    view: string;
    /** Preview fingerprint. A changed membership/layout must be previewed again. */
    expectedPlan?: string;
    /** Measured width of the viewing terminal; unknown widths keep the narrow default. */
    viewportColumns?: number;
}
export interface TerminalPreview {
    provider: string;
    view: string;
    planId: string;
    composed: ComposedView;
    /** The same pure grid roots consumed by the Herder adapter. */
    grids: ReturnType<typeof buildGridRoot>[];
    status: ProviderStatus;
}
/** The `rig terminal views` payload: saved views + the live rig names you can open. */
export interface ListViewsResult {
    saved: SavedView[];
    /** Rig names openable as per-rig derived views (live from the inventory). */
    rigs: string[];
    catalog?: Array<{
        view: string;
        name: string;
        kind: "saved" | "derived";
        members: string[];
        ready: number;
        absent: number;
        degraded: number;
        pages: number;
    }>;
}
/** One provider's doctor line for `rig terminal status`. */
export interface ProviderStatusReport {
    name: string;
    status: ProviderStatus;
    liveness: ProviderLiveness;
}
export interface TerminalStatusResult {
    providers: ProviderStatusReport[];
}
export interface TerminalServiceDeps {
    /** Resolve a provider name to its adapter, or null for an unknown name. */
    resolveProvider(name: string): TerminalProvider | null;
    /** The saved-views store (read paths only from this service). */
    viewsStore: Pick<TerminalViewsStore, "get" | "list">;
    /** Live seats of a rig BY NAME; null when no such rig is known (vs [] = a known-but-empty rig). */
    listRigSeats(rigName: string): Promise<LiveSeatRow[] | null> | LiveSeatRow[] | null;
    /** One request-local inventory fold for the derived catalog entries. */
    listRigSeatsBatch?(rigNames: string[]): Promise<Map<string, LiveSeatRow[]>> | Map<string, LiveSeatRow[]>;
    /** Live seats of a pod within a rig (by rig name-or-id + pod namespace); null when the rig/pod is unknown. */
    listPodSeats(rigArg: string, podNamespace: string): Promise<LiveSeatRow[] | null> | LiveSeatRow[] | null;
    /** Live seats for a derived scope (`mission:<id>` | `slice:<id>`); null when the scope is unknown/invalid. */
    listScopeSeats(scope: string): Promise<LiveSeatRow[] | null> | LiveSeatRow[] | null;
    /** Known rig names (for the `views` listing). */
    listRigNames(): Promise<string[]> | string[];
    /** Read-only host resolution for the composer (registry unavailable → null for every id). */
    resolveHost(id: string): HostEntry | null;
    /** Local liveness refine — has-session for a local tmux session; remote members are not probed here. */
    hasSession(tmuxSession: string): Promise<boolean> | boolean;
    /**
     * The tmux executable the daemon itself resolves, for local pane commands (#707). Only an
     * absolute path is used; anything else, or no resolver, keeps the bare `tmux` token.
     */
    resolveLocalTmux?(): Promise<string | null> | string | null;
}
/** The default kernel view's space name in a terminal multiplexer such as Herdr. */
export declare const KERNEL_SPACE_LABEL = "openrig kernel";
export declare class TerminalService {
    private readonly deps;
    private localTmux?;
    constructor(deps: TerminalServiceDeps);
    /** Resolved once, so a preview and the open that follows compose the same pane commands. */
    private resolveLocalTmux;
    /** An omitted provider takes the first in DEFAULT_PROVIDER_ORDER that is available and alive. With neither, it stays
     *  herdr, whose honest failure carries the direct attach commands. A named provider is used as named, errors and all.
     *  This picks only which provider; choosing a herdr session belongs inside the herdr provider. */
    private providerNameFor;
    /** Open a view in the chosen provider. Always returns the one shared result shape. */
    openView(req: OpenViewRequest): Promise<OpenViewResult>;
    private resolveComposed;
    private planId;
    /** Passive: inventory, local has-session and provider probe only. Never openView. */
    previewView(req: OpenViewRequest): Promise<TerminalPreview | OpenViewResult>;
    /** List saved views + the rig names openable as derived views. */
    listViews(detail?: boolean): Promise<ListViewsResult>;
    /** Provider availability + liveness (doctor). Unknown named provider → empty report for it. */
    status(providerName?: string): Promise<TerminalStatusResult>;
    /** Resolve a view argument into composer-ready members (precedence in the file header). */
    private resolveView;
    /** An in-memory default; a user's saved kernel view always takes precedence. */
    private defaultKernelView;
    /** Refine local members' liveness with a real has-session probe (a dead seat → absent, honest-partial). */
    private refineLiveness;
}
//# sourceMappingURL=terminal-service.d.ts.map