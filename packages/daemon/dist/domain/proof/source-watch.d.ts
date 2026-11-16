import type { EventBus } from "../event-bus.js";
export interface ProofSourceWatch {
    close(): void;
    observation(): {
        state: "watching" | "unavailable";
        revision: string;
    };
}
export declare function proofSourceObservation(c: {
    get: (key: never) => unknown;
}): {
    state: "watching" | "unavailable";
    revision: string;
};
/** Push invalidation over the existing bus; existing client quiet refresh is the missed-event repair. */
export declare function watchProofSources(missionsRoot: string, invalidate: () => void, bus: EventBus): ProofSourceWatch;
//# sourceMappingURL=source-watch.d.ts.map