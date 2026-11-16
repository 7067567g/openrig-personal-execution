export interface PluginVendorFs {
    readFile(path: string): string;
    writeFile(path: string, content: string): void;
    /** Copy raw bytes, failing if the recovery path already exists. */
    copyFileExclusive(source: string, target: string): void;
    exists(path: string): boolean;
    mkdirp(path: string): void;
    listFiles(dir: string): string[];
    rmrf?(path: string): void;
    /** Source file permission bits (for mode-preserving vendor staging). Optional: no-op if absent. */
    statMode?(path: string): number;
    /** Apply permission bits to a file (for mode-preserving vendor staging). Optional: no-op if absent. */
    chmod?(path: string, mode: number): void;
}
export interface HttpClientResponse {
    ok: boolean;
    status: number;
    /** Body parsed by caller — not exercised in v0 since fetch failures are
     *  the expected normal-state. Future tarball-extraction would consume this. */
    body?: unknown;
}
export type HttpClient = (url: string, opts?: {
    timeoutMs?: number;
}) => Promise<HttpClientResponse>;
export interface PluginVendorServiceDeps {
    vendoredAssetsDir: string;
    userPluginsDir: string;
    fs: PluginVendorFs;
    httpClient: HttpClient;
    logger?: (...args: unknown[]) => void;
}
export declare class PluginVendorService {
    private vendoredAssetsDir;
    private userPluginsDir;
    private fs;
    private httpClient;
    private logger;
    constructor(deps: PluginVendorServiceDeps);
    /** One plugin version across both harness manifests. Divergence is an
     * authority error: choosing either copy would make the other runtime lie. */
    private pluginVersion;
    /**
     * Seed the vendored asset tree at <vendoredAssetsDir>/<pluginName>/ into the
     * user plugin dir <userPluginsDir>/<pluginName> when absent, or advance it
     * only when the bundled manifest version is strictly newer. Equal versions
     * reconcile mode only on byte-identical files.
     * No-op when the vendored asset doesn't exist (e.g. plugin not bundled).
     */
    ensureVendored(pluginName: string): Promise<void>;
    /** Preserve every replaced file before touching a target, including its version authority. */
    private preserveBeforeRefresh;
    /**
     * Reapply the source file's permission bits to the staged/projected dest. Plain
     * readFile+writeFile (writeFileSync) creates the dest with the process default mode,
     * dropping executable bits on nested plugin helpers (e.g. claude-compaction-restore/
     * scripts/*.mjs, 0755). This vendor-staging hop (assets -> ~/.openrig/plugins) runs
     * UPSTREAM of the adapter CWD projection, so an unfixed mode here strands 0644 in the
     * staged copy that the adapters then faithfully preserve. No-op when the fs adapter does
     * not expose mode primitives (keeps existing mock-fs callers unaffected).
     */
    private preserveMode;
    /** Project one plugin skill into the harness-global skill roots. */
    ensureSkillGlobally(pluginName: string, skillName: string, globalSkillRoots: string[]): void;
    /**
     * Project one skill folder into the harness-global skill roots under `sourceVersion`
     * authority. A target without OpenRig's version marker was installed another way (for
     * example by skills.sh) and is left unchanged, as is one marked equal or newer.
     */
    ensureSkillDirGlobally(sourceDir: string, skillName: string, sourceVersion: string, globalSkillRoots: string[]): void;
    /**
     * Attempt to fetch the latest plugin tree from
     * github.com/mvschwarz/openrig-plugins. Tolerates 404, network errors,
     * and timeouts silently — vendored copy is ALWAYS the fallback.
     * Logs outcome for operator observability.
     */
    attemptAutoFetch(pluginName: string): Promise<void>;
    /**
     * Orchestrate vendored-first then fetch-attempt.
     * Local vendored/installed authority resolves first so a usable local copy
     * remains even if the fetch path fails for any reason.
     */
    ensureLatest(pluginName: string): Promise<void>;
}
//# sourceMappingURL=plugin-vendor-service.d.ts.map