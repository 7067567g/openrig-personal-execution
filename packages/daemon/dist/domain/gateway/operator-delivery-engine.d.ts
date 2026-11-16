import type { QueueItem, QueueRepository } from "../queue-repository.js";
import type { DispatchResult } from "./dispatcher.js";
import type { LoadResult } from "./human-registry.js";
export interface OperatorDeliveryEngine {
    dispatchEscalation: (row: QueueItem, reason: string) => Promise<{
        decision: string;
        resolved: boolean;
        notificationKey?: string;
        dispatched?: boolean;
        decisionId?: string;
    }>;
}
/** The T+30 fire payload: the ADVERTISED op's shape, the EPISODE key carried
 *  through so the Slice 14 receipt lands current-episode-exact, and the
 *  consult bypass so the already-made decision can never re-defer (AM-F3). */
export declare function buildDeferralFirePayload(row: QueueItem, notificationKey: string): Record<string, unknown>;
/** The production port for the operator rung (A1.2: this engine IS the rung's
 *  delivery leg). It decides via the one engine, dispatches the escalation
 *  through the REAL gateway on the advertised op, and returns resolved=false so
 *  the ladder exhausts only on the episode's own receipt/termination evidence
 *  (the AM-F3 resolution pass). Before acceptance, missing/unavailable routing
 *  remains unresolved. The ladder may re-resolve it; accepted delivery stays
 *  with the gateway until its receipt or explicit termination. */
export declare function makeOperatorDeliveryEngine(deps: {
    home: string;
    queueRepo: QueueRepository;
    dispatch: (op: string, entityBindingRef: string, payload: unknown, opts?: {
        decisionId?: string;
    }) => DispatchResult;
    registry?: {
        loadHumanRegistry: () => LoadResult;
    };
}): OperatorDeliveryEngine;
//# sourceMappingURL=operator-delivery-engine.d.ts.map