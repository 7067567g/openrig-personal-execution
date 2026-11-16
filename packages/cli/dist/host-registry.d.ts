import type { FailedStep } from "./cross-host-types.js";
export type { FailedStep };
export interface RemoteBearerResolution {
    ok: true;
    /** Absent for an anonymous (URL-only) host — a tokenless daemon, no
     *  Authorization header is sent. Present when bearer_env/bearer_file resolves. */
    token?: string;
}
export interface RemoteBearerFailure {
    ok: false;
    failedStep: FailedStep;
    error: string;
}
export declare function resolveRemoteBearer(host: HttpHostEntry): RemoteBearerResolution | RemoteBearerFailure;
/** Build the Authorization header for a resolved remote bearer. An anonymous
 *  (URL-only) host resolves to no token → no header (tokenless daemon). */
export declare function bearerAuthHeaders(token: string | undefined): Record<string, string>;
export declare function classifyHttpFailedStep(status: number, body?: {
    error?: string;
}): FailedStep;
export declare function classifyHttpError(_err: unknown): FailedStep;
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
/**
 * Load and validate the host registry from disk. v0 file shape:
 *
 *     hosts:
 *       - id: remote-dev
 *         transport: ssh
 *         target: remote-dev.local
 *         user: your-username  # optional
 *         notes: "Tart VM"     # optional
 *
 * Operator-managed; v0 does NOT auto-write or auto-modify this file. A missing
 * file returns a clear error pointing at the canonical path.
 */
export declare function loadHostRegistry(path?: string): HostRegistryLoadResult;
export declare function validateHostRegistry(parsed: unknown, sourcePath: string): HostRegistryLoadResult;
/**
 * Resolve a host id against a loaded registry. Unknown id returns an error
 * naming the requested id and listing up to 10 known ids for discoverability.
 */
export declare function hostDisplayTarget(host: HostEntry): string;
export declare function resolveHost(registry: HostRegistry, id: string, learnedBindings?: Record<string, {
    hostId: string;
}>): HostResolution;
export type AddHostResult = {
    ok: true;
    path: string;
    entry: HostEntry;
} | {
    ok: false;
    error: string;
};
/** OPR.0.4.6.MH1 (arch P3/P4): the CLI half of the ONE registry write
 *  contract — the daemon twin (packages/daemon/src/domain/hosts/
 *  hosts-registry-writer.ts) mirrors this verbatim, byte-parity-pinned by
 *  test. Concurrency ceiling (P4): atomic tmp+rename, whole-file
 *  LAST-WRITE-WINS on a concurrent add — one operator-scale registry
 *  file, NO locking machinery by design; a dropped concurrent entry
 *  re-converges by re-running the add. */
export declare function addHostEntry(rawEntry: Record<string, unknown>, path?: string): AddHostResult;
//# sourceMappingURL=host-registry.d.ts.map