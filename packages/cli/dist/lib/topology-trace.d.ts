export type TraceAltitude = "instance" | "rig" | "pod" | "seat";
export interface TraceLevel {
    altitude: TraceAltitude;
    /** The canonical path under topology.root for this level. */
    path: string;
    /** Where content was actually found: canonical, the legacy tree, or nowhere. */
    source: "topology.root" | "legacy" | "absent";
    /** The path the content was read from (canonical or legacy); null when absent. */
    resolvedPath: string | null;
    content: string | null;
    /** Present exactly when source === "legacy" — the named advisory. */
    advisory?: string;
}
export interface TraceResult {
    name: string;
    topologyRoot: string;
    /** Root-first: instance, rig, optional pod, optional seat — general to specific. */
    levels: TraceLevel[];
}
export interface TraceFs {
    exists(path: string): boolean;
    read(path: string): string;
}
/**
 * Walk the topology tree for one chain filename. `seat` is optional (a
 * rig-level trace stops at the rig altitude). Pure given `fs` — tests inject.
 */
export declare function traceTopologyChain(input: {
    topologyRoot: string;
    name: string;
    rig: string;
    pod?: string | null;
    seat?: string | null;
    legacyRigsRoot?: string;
    fs?: TraceFs;
}): TraceResult;
//# sourceMappingURL=topology-trace.d.ts.map