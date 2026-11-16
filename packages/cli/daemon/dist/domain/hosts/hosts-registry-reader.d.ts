export interface SshHostEntry {
    id: string;
    /**
     * The observed, immutable self-id of the host this entry points at — the JOIN KEY.
     *
     * `id` is MY label for that machine; `hostId` is what that machine calls itself and stamps into
     * every envelope it sends. Optional because every entry that exists today predates the field:
     * absent means "never learned", which resolves exactly as it does now. Nothing populates this
     * automatically in this slice.
     */
    hostId?: string;
    transport: "ssh";
    target: string;
    user?: string;
    notes?: string;
}
export interface HttpHostEntry {
    id: string;
    /** The observed self-id of the host this entry points at — the join key. See SshHostEntry.hostId. */
    hostId?: string;
    transport: "http";
    url: string;
    bearer_env?: string;
    bearer_file?: string;
    notes?: string;
}
export type HostEntry = SshHostEntry | HttpHostEntry;
export interface HostRegistry {
    hosts: HostEntry[];
}
export type HostRegistryLoadResult = {
    ok: true;
    registry: HostRegistry;
} | {
    ok: false;
    error: string;
};
export type HostResolution = {
    ok: true;
    host: HostEntry;
} | {
    ok: false;
    error: string;
};
export declare const RESERVED_HOST_IDS: Set<string>;
export declare function defaultHostRegistryPath(): string;
/** Load + validate the operator's hosts registry (read-only). Mirrors the CLI
 *  loader's error surfaces so operators see one vocabulary everywhere. */
export declare function loadHostRegistry(path?: string): HostRegistryLoadResult;
export declare function validateHostRegistry(parsed: unknown, sourcePath: string): HostRegistryLoadResult;
/** Resolve a host id for placement. Unknown id names the requested id and
 *  lists up to 10 known ids — the FR-4 per-entry validation message rides
 *  this (what/why/fix, before any launch attempt). */
export declare function resolveHost(registry: HostRegistry, id: string): HostResolution;
/** FR-4: placement requires a transport that can carry remote-up. v0 that is
 *  the http transport (the shipped remote single-rig leaf is POST /api/up
 *  over runRemoteHttpOp); ssh-transport hosts are reachable for send/capture
 *  but cannot carry remote-up — a structured per-entry error, not a launch
 *  attempt. */
export declare function resolvePlacementHost(registry: HostRegistry, id: string): HostResolution;
//# sourceMappingURL=hosts-registry-reader.d.ts.map