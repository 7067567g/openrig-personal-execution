import { Hono } from "hono";
export declare const CROSS_HOST_TAG = "cross-host";
export declare function crossHostProvenanceTags(existing: string[] | undefined): string[];
/** Human requests: canonical human destination or human blocker, excluding
 * explicit updates. Tier labels alone never create a human obligation. The same
 * predicate runs in SQL before LIMIT in QueueRepository.listAttention. */
export declare function isAttentionItem(q: {
    tier: string | null;
    destinationSession: string;
    state?: string;
    blockedOn?: string | null;
    humanIntent?: string | null;
}): boolean;
export declare function queueRoutes(): Hono;
//# sourceMappingURL=queue.d.ts.map