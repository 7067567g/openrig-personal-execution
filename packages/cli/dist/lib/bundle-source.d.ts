import { DaemonClient } from "../client.js";
import type { StatusDeps } from "../commands/status.js";
export interface BundleSource {
    repository: string;
    folder: string;
    requestedRef: string;
    resolvedCommit: string;
    canonicalUrl: string;
}
export declare const BUNDLE_LOCALITY_HELP = "GitHub bundle import needs a verified local daemon. Run this command on the daemon host, or create and transfer a .rigbundle there and use the existing path command. Nothing was fetched or installed.";
/** Only the new URL form enters this path; existing filesystem/name inputs keep their dispatch. */
export declare function isGitHubBundleLink(input: string): boolean;
export declare function parseGitHubBundleLink(input: string): {
    repository: string;
    refAndFolder: string[];
};
/** Resolve longest named ref, so branch names containing '/' do not become folder names. */
export declare function selectGitHubBundleSource(input: string, refs: string): BundleSource;
export declare function localBundleClient(deps: StatusDeps, host?: string): Promise<DaemonClient>;
export declare function bundleGit(cwd: string, args: string[]): Promise<string>;
export interface PreparedBundleSource {
    source: BundleSource;
    folder: string;
    checkoutDir: string;
    archivePath: string;
    receiptPath: string;
}
export declare function prepareGitHubBundle(input: string, git?: typeof bundleGit, importsRoot?: string): Promise<PreparedBundleSource>;
/** Authored minima enter the existing create/install contract only for the new source path. */
export declare function authoredCompatibility(folder: string): Record<string, string>;
export declare function bundleIdentityLines(data: Record<string, unknown>): string[];
/** The rig's own name from rig.yaml, which names a bundle unless --name says otherwise. */
export declare function rigSpecName(specPath: string): string | undefined;
export interface BundleLinkOptions {
    host?: string;
    output?: string;
    name?: string;
    bundleVersion?: string;
    preset?: string;
    seat?: string[];
    minDaemonVersion?: string;
    minCliVersion?: string;
    includePackages?: string[];
    includeLoginFiles?: boolean;
    contextPack?: string[];
    projectDir?: string;
    allowDrift?: boolean;
    provenance?: Record<string, unknown>;
}
/** Four commands share this preparation. The archive and receipt outlive install/history. */
export declare function importGitHubBundle(input: string, deps: StatusDeps, opts: BundleLinkOptions, prepare?: typeof prepareGitHubBundle): Promise<{
    client: DaemonClient;
    bundlePath: string;
    res: {
        status: number;
        data: Record<string, unknown>;
    };
}>;
export declare function printBundleLinkError(error: unknown, json?: boolean): void;
//# sourceMappingURL=bundle-source.d.ts.map