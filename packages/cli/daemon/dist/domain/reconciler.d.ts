import type Database from "better-sqlite3";
import type { SessionRegistry } from "./session-registry.js";
import type { EventBus } from "./event-bus.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
export interface ReconcileResult {
    checked: number;
    detached: number;
    errors: {
        sessionId: string;
        error: string;
    }[];
}
interface ReconcilerDeps {
    db: Database.Database;
    sessionRegistry: SessionRegistry;
    eventBus: EventBus;
    tmuxAdapter: TmuxAdapter;
}
export declare class Reconciler {
    private db;
    private sessionRegistry;
    private eventBus;
    private tmuxAdapter;
    constructor(deps: ReconcilerDeps);
    reconcile(rigId: string): Promise<ReconcileResult>;
}
export {};
//# sourceMappingURL=reconciler.d.ts.map