import type { PageRead } from "./page-read.js";
import type { ProjectSelection } from "./types.js";
/** Usage across hosts: the daemon answers by its 15 s view deadline; 15 s + 5 s for its own read and the transfer. */
export declare const USAGE_HOSTS_VIEW_WAIT_MS = 20000;
export interface DaemonClientOptions {
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    headers?: Record<string, string> | (() => Record<string, string>);
}
export declare class StartupRequestError extends Error {
    readonly status: number;
    readonly result: Record<string, unknown>;
    constructor(status: number, result: Record<string, unknown>);
}
/** One poll of a fleet-restore attempt (the daemon's GET status shape). The verdict is
 *  derived server-side from the rollup counts (never a stored field). */
export interface RestoreFleetStatus {
    done: boolean;
    cancelled: boolean;
    verdict: string;
    rollup: {
        counts: {
            fully_restored: number;
            partially_restored: number;
            failed: number;
            not_attempted: number;
        };
        sequence: Array<{
            rigId: string;
            outcome: string;
            reason?: string;
            remediation?: string;
        }>;
        attention_required: Array<{
            rigId: string;
            seat: string;
            need: string;
        }>;
    };
}
export interface TerminalOpenResult {
    provider: string;
    ok: boolean;
    opened: string[];
    absent: Array<{
        seat: string;
        reason: string;
    }>;
    degraded: Array<{
        seat: string;
        reason: string;
    }>;
    pages: number;
    error?: string;
    code?: string;
    notes?: string[];
    reusedWorkspace?: {
        id: string;
        tabId: string;
        view: string;
    };
}
export interface LaunchNodeResult {
    ok: boolean;
    code?: string;
    launched?: Array<{
        logicalId?: string;
    }>;
    alreadyRunning?: Array<{
        logicalId?: string;
    }>;
    warnings?: string[];
}
export declare function launchNodeNotice(agent: string, result: LaunchNodeResult): string;
export declare class DaemonClient {
    readonly baseUrl: string;
    private readonly fetchImpl;
    private optionalFetchImpl;
    private readonly headerSource;
    constructor(options?: DaemonClientOptions);
    forPage(page: PageRead, signal: AbortSignal): DaemonClient;
    private get headers();
    /** S19 AM-R18 — open the oracle's SSE event stream (FR-8: HTTP stays in THIS module).
     *  FEATURE-DETECTED: a non-OK or non-event-stream answer (an older daemon, a foreign
     *  server) returns null — the caller disables the leg permanently and the TUI behaves
     *  exactly as S16 shipped it (click-to-refresh). Never retried on null. Opening
     *  timeouts/network errors reject so the subscriber can back off and retry. */
    openActivityEvents(): Promise<Response | null>;
    private get;
    private post;
    /** Running daemon identity. `selfHostId` may be absent on an older daemon. */
    configBrowser(): Promise<Partial<import("./config/config-model.js").ConfigRead>>;
    humanUpdates(): Promise<unknown>;
    connections(): Promise<unknown>;
    slackManifest(): Promise<unknown>;
    fileRoots(): Promise<{
        roots: import("./reading.js").FileRoot[];
        hint?: string;
    }>;
    readFile(target: import("./reading.js").FileTarget): Promise<import("./reading.js").FileReadResult>;
    health(): Promise<unknown>;
    /** Slice 01 — the provider read model, as `rig provider status --json` prints it. GET only: the daemon answers it
     *  from memory and never starts a native read for it; this client never calls the refresh route. A failed or
     *  absent route resolves to its status (404: a daemon without provider routes) instead of throwing. */
    providerStatus(): Promise<import("./usage/usage-model.js").UsageRead["status"]>;
    /** Slice 01 — usage windows across registered hosts, as `rig provider status --all-hosts --json` prints them. GET
     *  only: the daemon and every host answer from memory, and this client has no method for the refresh route. A
     *  failed or absent route resolves to its status, with the daemon's own message (409: usage windows off here). */
    usageAcrossHosts(): Promise<import("./usage/usage-hosts-model.js").UsageHostsRead["status"]>;
    /** Slice 02 — the cost view, as `rig usage cost --json` prints it. GET only, computed from what the daemon already
     *  stores: no provider lookup, native read or charge lookup. A failed or absent route resolves to its status. */
    usageCost(): Promise<import("./cost/cost-read.js").CostRead["status"]>;
    /** Bounded canonical findings; the TUI filters this one record set by scope. */
    healthFindings(limit?: number): Promise<unknown>;
    /** Kick the async fleet restore; the daemon answers on-commit with a fleet-attempt handle. */
    restoreFleet(): Promise<{
        fleetAttemptId: string;
        status: string;
    }>;
    /** Poll one fleet-attempt's progress + rollup + derived verdict. */
    restoreFleetStatus(id: string): Promise<RestoreFleetStatus>;
    /** Request stop-before-next-rig cancel on a running fleet attempt. */
    cancelRestoreFleet(id: string): Promise<{
        ok: boolean;
        cancelled: boolean;
    }>;
    rigGraph(rigId: string): Promise<unknown>;
    ps(): Promise<unknown>;
    rigsSummary(): Promise<unknown>;
    rigNodes(rigId: string): Promise<unknown>;
    reviewAgents(scope?: "rig" | "fleet"): Promise<unknown>;
    specsLibrary(kind?: string): Promise<unknown>;
    rigSpec(rigId: string): Promise<unknown>;
    /** structured spec detail (spec-library.ts /:id/review — the live route;
     * the spec's §4.A cite `GET /api/specs/review` 404s at tip, QA-found) */
    specLibraryReview(id: string): Promise<unknown>;
    /** SCOPES view (d64d2f5c): the store-direct one-read hydrate. */
    projects(): Promise<unknown>;
    private projectQuery;
    scopesDetailed(project?: ProjectSelection | null): Promise<unknown>;
    /** EXECUTION view via the shipped generic view route; no new endpoint. */
    execution(mission?: string, project?: ProjectSelection | null): Promise<unknown>;
    /** Existing six-tab slice payload; read only for the opened slice. */
    sliceDetail(directory: string, mission?: string | null, project?: ProjectSelection | null): Promise<unknown>;
    /** One bounded typed queue chronology for the current topology scope. */
    queueRecentTransitions(scope: {
        kind: "instance";
    } | {
        kind: "rig";
        rig: string;
    }, limit?: number): Promise<unknown>;
    queueAttention(): Promise<unknown>;
    /** ALL blocked qitems via the SAME shipped /list route with ?state=blocked
     * (queue.ts reads c.req.query("state") and filters). Mirror of queueAttention
     * — a client-method addition on an existing route, NOT a new endpoint.
     * The PULSE render filters these to NON-human blockedOn. */
    queueBlocked(): Promise<unknown>;
    /** ALL in-progress qitems via the SAME shipped /list route with ?state=in-progress
     * (queue.ts reads c.req.query("state") and filters). Mirror of queueBlocked — a
     * client-method addition on an existing route, NOT a new endpoint. The PULSE
     * PARKED join keeps only idle, un-handed-off owners. */
    queueInProgress(): Promise<unknown>;
    /** ALL unclaimed pending qitems via the SAME shipped /list route with
     * ?state=pending (the UP NEXT backlog). Mirror of queueInProgress — a
     * client-method addition on an existing route, NOT a new endpoint. The daemon
     * serves ts_created DESC; the PULSE render keeps only unclaimed + caps display.
     * Bounded so a huge backlog can't unbound the frame. */
    queuePending(limit?: number): Promise<unknown>;
    /** Recent terminal transitions (JUST FINISHED) via the SAME shipped /list
     * route with a COMMA multi-state ?state=done,handed-off (queue.ts splits
     * stateRaw on ","). No fleet-wide finish-time transitions endpoint exists, so
     * this is a bounded RECENT WINDOW fetched in ts_created order; the PULSE render
     * re-sorts by tsUpdated DESC (finish time) for newest-first. NOT a new endpoint. */
    queueRecentlyFinished(limit?: number): Promise<unknown>;
    /** A single qitem by id via the shipped GET /api/queue/:qitemId (queue.ts:864,
     * returns the QueueItem or 404). Used for the BLOCKED ON AGENTS bounded per-row
     * lookup: blockedOn is a qitem POINTER, so the blocking agent is that qitem's
     * owner (destinationSession). NOT a new endpoint. */
    humanAttention(item?: string | null): Promise<unknown>;
    queueItem(qitemId: string, options?: {
        optional?: boolean;
    }): Promise<unknown>;
    reviewRig(): Promise<unknown>;
    reviewFleet(): Promise<unknown>;
    attentionAggregate(): Promise<unknown>;
    rigStatus(rigId: string): Promise<unknown>;
    /** legacy chronological page contract, retained for additive API compatibility */
    streamList(limit?: number, afterSortKey?: string): Promise<unknown>;
    /** newest bounded page of the maintained active stream, returned oldest→newest */
    streamLatest(limit?: number): Promise<unknown>;
    /** the web's TerminalLauncher contract: POST /api/terminal/open {view} */
    terminalViews(): Promise<{
        saved: Array<{
            id: string;
            name: string;
            members: Array<{
                seat: string;
            }>;
        }>;
        rigs: string[];
    }>;
    /** The preview behind "Open terminals". That action opens through `rig terminal open --window`, which composes with
     *  Herdr's layout and falls back to plain tmux without Herdr, so preview the same composition: its planId is the
     *  window opener's expected plan. A provider-less preview may pick cmux, whose plan the window opener never matches. */
    previewTerminal(view: string): Promise<import("./terminals/terminal-model.js").TerminalPreview>;
    openTerminal(view: string, expectedPlan?: string): Promise<TerminalOpenResult>;
    /** the `rig launch` per-seat contract */
    launchNode(rigId: string, logicalId: string): Promise<LaunchNodeResult>;
    startupRequest<T>(route: string, body?: unknown): Promise<T>;
}
//# sourceMappingURL=daemon-client.d.ts.map