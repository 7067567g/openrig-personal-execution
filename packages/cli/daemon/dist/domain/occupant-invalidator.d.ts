export interface OccupantInvalidator {
    invalidateRetiringOccupant(args: {
        retiringSessionName: string;
        successorSessionName: string;
        retiringGeneration?: string;
    }): void;
}
/** Deps the default invalidator composes — structural so tests inject fakes and there is no hard
 *  import cycle with the enforcer / context-usage store. */
export interface OccupantInvalidatorDeps {
    enforcer: {
        invalidateOccupant(sessionName: string): void;
    };
    contextUsage: {
        invalidateOccupantSidecar(sessionName: string): void;
    };
    /** (e/Class-B) durable watchdog_jobs store — armed jobs registered by the retiring generation are
     *  stopped at swap (a stale wake into the successor's context is the ghost). Optional: absent ⇒ the
     *  watchdog branch is skipped (never a name-scoped fallback). */
    watchdog?: {
        dropArmedByRegisteringGeneration(generationUuid: string, keepJobIds?: readonly string[]): number;
    };
    /** (e/Class-B) durable queue_items store — in-progress items claimed by the retiring generation are
     *  RELEASED to pending (never dropped: the role work is durable, the successor re-claims). Its current
     *  park timers (blocked rows' wakes) are role work too, so the watchdog drop keeps them. Optional. */
    queue?: {
        releaseClaimsByGeneration(generationUuid: string): number;
        currentParkTimerIds?(): string[];
    };
    log?: (msg: string) => void;
}
export declare class DefaultOccupantInvalidator implements OccupantInvalidator {
    private readonly deps;
    constructor(deps: OccupantInvalidatorDeps);
    invalidateRetiringOccupant(args: {
        retiringSessionName: string;
        successorSessionName: string;
        retiringGeneration?: string;
    }): void;
}
//# sourceMappingURL=occupant-invalidator.d.ts.map