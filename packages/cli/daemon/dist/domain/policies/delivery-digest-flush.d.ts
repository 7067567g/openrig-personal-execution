import type { QueueRepository } from "../queue-repository.js";
import type { OwnerNotificationLevel } from "../queue-transition-log.js";
import type { Policy } from "./types.js";
export declare const DELIVERY_DIGEST_FLUSH_POLICY = "delivery-digest-flush";
interface RegistrySurfaceLike {
    loadHumanRegistry: (home: string) => {
        ok: boolean;
        entities?: Array<{
            entityId: string;
            address: string;
        }>;
    };
}
export interface RunDeliveryDigestFlushInput {
    queueRepo: QueueRepository;
    registry: RegistrySurfaceLike;
    home: string;
    dispatch: (op: string, entityBindingRef: string, payload: unknown, opts?: {
        decisionId?: string;
    }) => {
        ok: boolean;
        error?: string;
    };
    window: "4h" | "daily";
    minimumLevel?: OwnerNotificationLevel;
}
export declare function runDeliveryDigestFlush(input: RunDeliveryDigestFlushInput): Promise<{
    dispatched: number;
    members: number;
}>;
/** Watchdog-engine policy wrapper — the repeating window flush (digests recur;
 *  only the deferral is one-shot). */
export declare function makeDeliveryDigestFlushPolicy(deps: {
    queueRepo: QueueRepository;
    registry: RegistrySurfaceLike;
    home: string;
    dispatch: (op: string, entityBindingRef: string, payload: unknown, opts?: {
        decisionId?: string;
    }) => {
        ok: boolean;
        error?: string;
    };
}): Policy;
export {};
//# sourceMappingURL=delivery-digest-flush.d.ts.map