import type Database from "better-sqlite3";
export interface BundleInstallContext {
    offered: {
        name: string;
        version: string | null;
        source: string;
    };
    existing: Array<{
        rigId: string;
        name: string;
        state: "running" | "stopped";
        source: string | null;
        version: null;
    }>;
    resolutions: string[];
}
/** Read the same session predicate as the import guard. A stored rig is not necessarily running. */
export declare function bundleInstallContext(db: Database.Database, rigName: string, offered: BundleInstallContext["offered"]): BundleInstallContext;
/** Require the recorded folder when available; old generations retain the manifest-only check. */
export declare function isExistingBundleTarget(context: BundleInstallContext, target: string, db: Database.Database): boolean;
export declare function bundleInstallContextLines(context: BundleInstallContext, includeChoices?: boolean): string[];
//# sourceMappingURL=bundle-install-context.d.ts.map