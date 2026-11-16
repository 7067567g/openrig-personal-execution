import type { ExplorerRow, FleetSnapshot, GetSnapshot, SectionDef, ViewState, ViewStateStore, SpecKind } from "./types.js";
export declare function defaultSections(): SectionDef[];
export declare function emptySnapshot(): FleetSnapshot;
export interface CreateViewStateOptions {
    instanceId: string;
    timeZone?: string;
    timeZoneWarning?: string | null;
    sections?: SectionDef[];
    getSnapshot?: GetSnapshot;
}
export declare function createViewState(options: CreateViewStateOptions): ViewStateStore;
/** The founder scroll fix (class-(b) focus-model defect): on a SCROLLABLE spec
 *  detail the body IS the meaningful surface, so reflexive ↑↓ scroll it —
 *  while the explorer holds focus (focus resets to explorer on every
 *  drill, which is why the reflexive keys used to drive the hidden tree). Gated
 *  on real scrollability (contentMaxOffset), so a non-overflowing spec detail
 *  keeps its link-hop / explorer behavior. The key ROUTING (input.ts) and the
 *  footer/indicator affordances (render.ts) both read this ONE predicate, so
 *  the hint can never again promise a gesture the keys don't perform. */
export declare function specDetailArrowsScroll(state: ViewState): boolean;
/** The explorer key for the state's current location (drill leaf or section). */
export declare function locationKey(state: ViewState): string;
export declare function findAgent(snap: FleetSnapshot, name: string, target?: {
    host: string;
    rig?: string;
    pod?: string;
}): {
    host: import("./types.js").HostNode;
    rig: import("./types.js").RigNode;
    pod: import("./types.js").PodNode;
    agent: import("./types.js").AgentRow;
} | null;
export declare function findSpec(snap: FleetSnapshot, name: string, kind?: SpecKind): import("./types.js").SpecEntry | null;
/** Joins a Needs-You target (a session name) back to the topology agent. */
export declare function findAgentBySession(snap: FleetSnapshot, session: string, hostId?: string): {
    host: import("./types.js").HostNode;
    rig: import("./types.js").RigNode;
    pod: import("./types.js").PodNode;
    agent: import("./types.js").AgentRow;
} | null;
export declare function findRig(snap: FleetSnapshot, name: string, hostName?: string): {
    host: import("./types.js").HostNode;
    rig: import("./types.js").RigNode;
} | null;
export declare function agentsRunningSpec(snap: FleetSnapshot, specName: string): string[];
export declare function agentsRunningSpecTargets(snap: FleetSnapshot, specName: string): {
    host: import("./types.js").HostNode;
    rig: import("./types.js").RigNode;
    pod: import("./types.js").PodNode;
    agent: import("./types.js").AgentRow;
}[];
export declare function computeExplorerRows(state: ViewState, snap: FleetSnapshot): ExplorerRow[];
//# sourceMappingURL=state.d.ts.map