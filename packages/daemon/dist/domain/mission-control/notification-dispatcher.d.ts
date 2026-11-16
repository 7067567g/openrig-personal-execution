import type Database from "better-sqlite3";
import type { EventBus } from "../event-bus.js";
import type { NotificationAdapter } from "./notification-adapter-types.js";
export interface NotificationDispatcherDeps {
    db: Database.Database;
    eventBus: EventBus;
    adapter: NotificationAdapter;
    /**
     * When true, dispatch on `mission_control.action_executed` events
     * (verb completion). Default false: only human-gate arrivals
     * trigger by default (per planner brief mandatory trigger).
     */
    includeVerbCompletion?: boolean;
    missionControlBaseUrl?: string;
    now?: () => Date;
}
export declare class MissionControlNotificationDispatcher {
    private readonly db;
    private readonly eventBus;
    private readonly adapter;
    private readonly includeVerbCompletion;
    private readonly missionControlBaseUrl;
    private readonly now;
    private unsubscribe;
    /** Per-(qitem_id, mechanism) drop set for once-per-qitem dedup. */
    private readonly dispatchedKeys;
    constructor(deps: NotificationDispatcherDeps);
    /** Subscribe to relevant EventBus events. Idempotent. */
    start(): void;
    /** Unsubscribe + clear dedup set. Idempotent. */
    stop(): void;
    /**
     * Send a synthetic notification through the configured adapter so
     * the operator can verify their setup. Used by the
     * `POST /api/mission-control/notifications/test` route.
     */
    sendTest(): Promise<{
        mechanism: string;
        target: string;
        ok: boolean;
        ack?: string;
        error?: string;
    }>;
    private handleEvent;
    private dispatch;
    private emitSent;
    private emitFailed;
    private lookupQitem;
    private qitemRef;
    /** Test/observability: clear once-per-qitem dedup set. */
    resetDedupForTest(): void;
}
//# sourceMappingURL=notification-dispatcher.d.ts.map