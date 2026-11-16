/**
 * OPR.0.5.3.6 — shipped topology chain-file defaults (CE-v2 as product).
 *
 * A rig spec may carry a `topology/` folder of sensible-default chain files.
 * At rig-up they install under the typed `topology.root` (see
 * docs/reference/chain-file-convention.md — the SSOT), at four altitudes:
 *
 *   <spec>/topology/instance/<NAME>.md      -> <topology.root>/<NAME>.md
 *   <spec>/topology/rig/<NAME>.md           -> <topology.root>/rigs/<rig>/<NAME>.md
 *   <spec>/topology/pods/<pod>/<NAME>.md    -> <topology.root>/rigs/<rig>/pods/<pod>/<NAME>.md
 *   <spec>/topology/seats/<seat>/<NAME>.md  -> <topology.root>/rigs/<rig>/seats/<seat>/<NAME>.md
 *
 * COPY-IF-ABSENT, never overwrite: a shipped default is a starting point the
 * occupying team appends to — a later rig-up must never clobber earned
 * context. Installation is best-effort per file (a rig launch never fails on
 * a defaults copy) but every skip/install is reported so the caller can log
 * honestly rather than silently.
 */
export interface TopologyDefaultsResult {
    installed: string[];
    /** Destination existed — the shipped default did not overwrite it. */
    preserved: string[];
    /** Read/write failures, named (best-effort contract: never throws). */
    failed: Array<{
        path: string;
        error: string;
    }>;
    /** True when the spec ships no topology/ folder at all (a normal case). */
    none: boolean;
}
export interface TopologyDefaultsFsOps {
    exists(path: string): boolean;
    isDirectory(path: string): boolean;
    listFiles(dir: string): string[];
    listDirs(dir: string): string[];
    read(path: string): string;
    write(path: string, content: string): void;
    mkdirp(dir: string): void;
}
export declare function installTopologyDefaults(input: {
    /** The rig spec's directory (rigRoot) — `topology/` is resolved beneath it. */
    specDir: string;
    rigName: string;
    /** Declared pod namespaces. Their canonical directories exist even when no default file ships. */
    podIds?: string[];
    topologyRoot: string;
    fsOps?: TopologyDefaultsFsOps;
}): TopologyDefaultsResult;
//# sourceMappingURL=topology-defaults-installer.d.ts.map