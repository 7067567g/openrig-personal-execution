import type { AggregatedPayload } from "../hosts/fanout-contract.js";
import type { HostRegistryLoadResult } from "../hosts/hosts-registry-reader.js";
/** The aggregation READ deadline class (per-host bound). Distinct from the
 *  up-leaf's long-running budget by design — named here, passed explicitly. */
export declare const ATTENTION_READ_TIMEOUT_MS = 5000;
/** Fixed fan-out cap — a poll across a handful of hosts; adaptive
 *  throttling is out of scope (same v1 posture as the topology walker). */
export declare const ATTENTION_FANOUT_CONCURRENCY = 4;
export type AttentionItem = Record<string, unknown>;
export interface AttentionAggregatorDeps {
    /** The SAME query the shipped /api/queue/list?attention=1 route runs. */
    listLocalAttention: () => AttentionItem[];
    /** settings-store.listFeedHostSubscriptions (the G15-P1 dynamic class). */
    listSubscriptions: () => Array<{
        hostId: string;
        enabled: boolean;
    }>;
    /** S11's shared reader — called lazily, only when a remote sub exists. */
    loadRegistry: () => HostRegistryLoadResult;
    fetchImpl?: typeof fetch;
    env?: Record<string, string | undefined>;
    readFile?: (path: string) => string;
    /** Test override; production uses ATTENTION_READ_TIMEOUT_MS. */
    timeoutMs?: number;
    concurrency?: number;
}
/** One merged attention payload: local ALWAYS included (stamped with the
 *  contract's LOCAL_HOST_ID), each enabled remote host fanned out under the
 *  read deadline + fixed cap, per-host status complete by construction. */
export declare function aggregateAttention(deps: AttentionAggregatorDeps): Promise<AggregatedPayload<AttentionItem>>;
//# sourceMappingURL=attention-aggregator.d.ts.map