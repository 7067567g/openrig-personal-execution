import type { AgentRow, ComposedFleet, ComposedRigAgents, NeedsYouItem, SettledRow } from "./types.js";
import type { PerHostStatus } from "../hosts/fanout-contract.js";
import type { HostRegistryLoadResult } from "../hosts/hosts-registry-reader.js";
/** The ordinary TUI/CLI caller gives GET five seconds. Reserve one second
 *  (20%) for union/serialization, transport and scheduling after fan-out;
 *  remote waits share the remaining four seconds, INCLUDING elapsed local
 *  work. This margin is not a guarantee under synchronous/event-loop stalls. */
export declare const FLEET_READ_TIMEOUT_MS: number;
/** Fixed fan-out cap — a poll across a handful of hosts (the shipped
 *  aggregator's v1 posture; adaptive throttling out of scope). */
export declare const FLEET_FANOUT_CONCURRENCY = 4;
/** One altitude read of a host's composed needs-you rows. Production (D-1)
 *  supplies exactly one entry per reachable host — its rig root — so
 *  seenFrom renders `rig`; the union machinery is correct for any scoped
 *  set (the C5 3-altitude vector feeds slice+mission+rig). */
export interface ScopedNeedsYou {
    scope: string;
    items: NeedsYouItem[];
}
/** One reachable fleet member's contribution to the union. */
export interface FleetHostInput {
    hostId: string;
    kind: "local" | "remote";
    scopedNeedsYou: ScopedNeedsYou[];
    agents: AgentRow[];
    settled: SettledRow[];
}
/** Union + host-dimension + count (the ONLY things the fleet root does).
 *  `statuses` must carry EVERY fleet member (omission-proof); `inputs`
 *  carries only the members whose composed set was actually read. */
export declare function unionFleet(inputs: FleetHostInput[], statuses: PerHostStatus[], composedAt: string, registryError?: string): ComposedFleet;
export interface FleetComposeDeps {
    /** D-1: the LOCAL host joins in-process — zero self-transport. */
    composeLocalRig: () => ComposedRigAgents;
    /** S11's shared reader — the fleet enumerates EVERY registered host. */
    loadRegistry: () => HostRegistryLoadResult;
    /** Registry presence probe (a missing registry = a single-host operator —
     *  clean local-only fleet; an unreadable one is surfaced honestly). */
    registryExists: () => boolean;
    /** View-time fact, passed in — the union never derives time state. */
    nowIso: string;
    fetchImpl?: typeof fetch;
    env?: Record<string, string | undefined>;
    readFile?: (path: string) => string;
    /** Test override for the TOTAL elapsed budget; never per-host/per-wave. */
    timeoutMs?: number;
    concurrency?: number;
}
/** ONE composed fleet: local always included (in-process, D-1), every
 *  registered host fanned out concurrently under the named deadline (D-7),
 *  per-host status complete by construction, union deduped on the Q4 key. */
export declare function composeFleet(deps: FleetComposeDeps): Promise<ComposedFleet>;
//# sourceMappingURL=fleet-compose.d.ts.map