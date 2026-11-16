import { DaemonClient } from "./client.js";
import { loadHostRegistry } from "./host-registry.js";
import { type LifecycleDeps } from "./daemon-lifecycle.js";
import type { FailedStep } from "./cross-host-types.js";
export interface RemoteHostDeps {
    clientFactory: (url: string) => DaemonClient;
    hostRegistryLoader?: () => ReturnType<typeof loadHostRegistry>;
    /**
     * A4: present ⇒ `runRemoteHttpOp` resolves THIS host's `selfHostId` (fail-open) and stamps the origin
     * TRIPLE on the remote request so the remote daemon renders the ORIGIN host. Absent (some test mocks)
     * ⇒ the 2-part header stamps, fail-open — no new failure mode. The 8 command modules that call this
     * pass their command deps (which carry `lifecycleDeps`), so the production remote path stamps the triple.
     */
    lifecycleDeps?: LifecycleDeps;
}
export interface RemoteOpResult {
    ok: boolean;
    failedStep: FailedStep;
    data?: unknown;
    error?: string;
    /** The request may have reached the remote and been acted on, but no usable answer came back: a timeout, a
     *  connection reset or dropped mid-request, or an unreadable response. Unset when the connection provably
     *  never reached the remote. A caller whose request writes must not read such a failure as "not done". */
    outcomeUnknown?: true;
}
export declare function runRemoteHttpOp(hostId: string, method: "GET" | "POST", apiPath: string, body: unknown | undefined, deps: RemoteHostDeps, opts: {
    json?: boolean;
    timeoutMs?: number;
}): Promise<RemoteOpResult>;
/** How a rig handle matched a host's rig list: an exact id first (archived rigs included), else one active rig of
 *  that name. Non-object rows (null, primitives) take no part, so they can't hide or block a match. A row without a
 *  string `rigId` can't be a target, but an active one still counts toward a name's ambiguity, and a name only it
 *  carries is not found. `unavailable` means the list itself couldn't be read or wasn't a list, so nothing is known. */
export type RemoteRigLookup = {
    kind: "resolved";
    rigId: string;
    byName: boolean;
}
/** `count` is every active row with that name; `ids` the ones that can be targeted. */
 | {
    kind: "ambiguous";
    count: number;
    ids: string[];
} | {
    kind: "not_found";
} | {
    kind: "unavailable";
    error: string | undefined;
};
export declare function lookupRemoteRigId(hostId: string, handle: string, deps: RemoteHostDeps): Promise<RemoteRigLookup>;
export declare function resolveRemoteRigId(hostId: string, handle: string, deps: RemoteHostDeps): Promise<{
    ok: true;
    rigId: string;
} | {
    ok: false;
    error: string;
}>;
//# sourceMappingURL=remote-host-ops.d.ts.map