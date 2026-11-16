import type Database from "better-sqlite3";
import type { BootstrapRun, BootstrapAction, BootstrapStatus, ActionKind, ActionStatus } from "./bootstrap-types.js";
export declare class BootstrapRepository {
    readonly db: Database.Database;
    constructor(db: Database.Database);
    createRun(sourceKind: string, sourceRef: string): BootstrapRun;
    getRun(id: string): BootstrapRun | null;
    listRuns(): BootstrapRun[];
    updateRunStatus(id: string, status: BootstrapStatus, opts?: {
        rigId?: string;
        appliedAt?: string;
    }): void;
    journalAction(bootstrapId: string, seq: number, actionKind: ActionKind, subjectType: string | null, subjectName: string | null, status: ActionStatus, opts?: {
        provider?: string;
        commandPreview?: string;
        detailJson?: string;
    }): BootstrapAction;
    getRunActions(bootstrapId: string): BootstrapAction[];
    private getAction;
    private rowToRun;
    private rowToAction;
}
//# sourceMappingURL=bootstrap-repository.d.ts.map