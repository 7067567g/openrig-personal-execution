import type Database from "better-sqlite3";
export interface Package {
    id: string;
    name: string;
    version: string;
    sourceKind: string;
    sourceRef: string;
    manifestHash: string;
    summary: string | null;
    createdAt: string;
}
export interface PackageSummary extends Package {
    installCount: number;
    latestInstallStatus: string | null;
}
export declare class PackageRepository {
    readonly db: Database.Database;
    constructor(db: Database.Database);
    createPackage(opts: {
        name: string;
        version: string;
        sourceKind: string;
        sourceRef: string;
        manifestHash: string;
        summary?: string;
    }): Package;
    getPackage(id: string): Package | null;
    findByNameVersion(name: string, version: string): Package | null;
    listPackages(): Package[];
    listPackageSummaries(): PackageSummary[];
    private rowToPackage;
}
//# sourceMappingURL=package-repository.d.ts.map