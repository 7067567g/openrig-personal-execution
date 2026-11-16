import type Database from "better-sqlite3";
/** Common provenance on existing diagnostic queue rows, never a second ledger.
 * Both deadline and delivery detectors consult the same recovery disposition. */
export declare const recoveryTag: (qitemId: string) => string;
export declare function recoveryId(db: Database.Database, qitemId: string): string;
export declare function findQueueRecovery(db: Database.Database, qitemId: string): {
    qitemId: string;
    state: string;
} | null;
//# sourceMappingURL=queue-recovery.d.ts.map