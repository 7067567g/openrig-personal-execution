import type Database from "better-sqlite3";
export interface Install {
    id: string;
    packageId: string;
    targetRoot: string;
    scope: string;
    status: string;
    riskTier: string | null;
    createdAt: string;
    appliedAt: string | null;
    rolledBackAt: string | null;
}
export interface InstallSummary extends Install {
    appliedCount: number;
    deferredCount: null;
}
export interface JournalEntry {
    id: string;
    installId: string;
    seq: number;
    action: string;
    exportType: string;
    classification: string;
    targetPath: string;
    backupPath: string | null;
    beforeHash: string | null;
    afterHash: string | null;
    status: string;
    createdAt: string;
}
export declare class InstallRepository {
    readonly db: Database.Database;
    constructor(db: Database.Database);
    createInstall(packageId: string, targetRoot: string, scope: string, bootstrapId?: string): Install;
    updateInstallStatus(installId: string, status: string): void;
    getInstall(installId: string): Install | null;
    listInstallSummaries(packageId: string): InstallSummary[];
    listInstalls(packageId?: string): Install[];
    createJournalEntry(opts: {
        installId: string;
        action: string;
        exportType: string;
        classification: string;
        targetPath: string;
        backupPath?: string;
        beforeHash?: string;
        afterHash?: string;
        status?: string;
    }): JournalEntry;
    getJournalEntries(installId: string): JournalEntry[];
    private getJournalEntry;
    private rowToInstall;
    private rowToJournalEntry;
}
//# sourceMappingURL=install-repository.d.ts.map