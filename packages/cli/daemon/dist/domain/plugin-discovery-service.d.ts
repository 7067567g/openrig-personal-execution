export type PluginRuntime = "claude" | "codex";
export type PluginSourceKind = "vendored" | "claude-cache" | "codex-cache" | "rig-cwd";
export interface PluginEntry {
    /** Stable id for routing (`openrig-core`, `<marketplace>:<plugin>:<version>`). */
    id: string;
    /** Plugin's declared name from manifest. */
    name: string;
    /** Plugin's declared version. */
    version: string;
    /** Optional description from manifest. */
    description: string | null;
    /** Source root where this plugin was discovered. */
    source: PluginSourceKind;
    /**
     * Human-readable provenance label per DESIGN.md §5.4 + IMPL-PRD §3.2:
     *   - `vendored:<plugin>`
     *   - `claude-cache:<marketplace>/<plugin>/<version>`
     *   - `codex-cache:<marketplace>/<plugin>/<version>`
     */
    sourceLabel: string;
    /** Which runtimes this plugin supports (presence of manifest dirs). */
    runtimes: PluginRuntime[];
    /** Filesystem path to the plugin root. */
    path: string;
    /**
     * mtime of the manifest file (used as a soft "last loaded" approximation
     * for the UI list view; exact "loaded by runtime" timestamp is out of
     * scope at v0).
     */
    lastSeenAt: string | null;
    /**
     * Slice 28 — number of skill folders shipped under `<plugin>/skills/`.
     * Surfaced in the list response so the PluginsIndexPage can render a
     * skill-count column without an N+1 detail fetch per plugin row.
     * Counted at detectPlugin time (one readdir of skills/).
     *
     * SC-29 EXCEPTION #11 (slice 28 library-explorer-finishing):
     * adds skillCount field to PluginEntry — additive shape change to
     * the plugin discovery API contract. Per banked inline-ledger
     * discipline; declared verbatim in routes/plugins.ts header.
     */
    skillCount: number;
}
export interface PluginManifestSummary {
    /** Original manifest object from `<plugin>/.claude-plugin/plugin.json`. */
    raw: Record<string, unknown>;
    /** Convenience-extracted fields (best-effort; null if missing). */
    name: string | null;
    version: string | null;
    description: string | null;
    homepage: string | null;
    repository: string | null;
    license: string | null;
}
export interface PluginSkillSummary {
    /** Skill folder name. */
    name: string;
    /** Path relative to plugin root. */
    relativePath: string;
}
export interface PluginHookSummary {
    /** Which runtime this hook config targets. */
    runtime: PluginRuntime;
    /** Path relative to plugin root. */
    relativePath: string;
    /** Hook event names declared (best-effort parse). */
    events: string[];
}
export interface PluginMcpServerSummary {
    /** Which runtime manifest declared this MCP server. */
    runtime: PluginRuntime;
    /** Server name (object key in the manifest's mcpServers map). */
    name: string;
    /** Declared command if the entry is a stdio-style spec. */
    command: string | null;
    /** Declared transport (stdio/http/etc) if the entry exposes it. */
    transport: string | null;
}
export interface PluginDetail {
    /** The list-view entry. */
    entry: PluginEntry;
    /** Parsed `.claude-plugin/plugin.json` if present. */
    claudeManifest: PluginManifestSummary | null;
    /** Parsed `.codex-plugin/plugin.json` if present. */
    codexManifest: PluginManifestSummary | null;
    /** Skill folders shipped under `<plugin>/skills/`. */
    skills: PluginSkillSummary[];
    /** Hook configs shipped under `<plugin>/hooks/`. */
    hooks: PluginHookSummary[];
    /**
     * MCP server declarations from claude/codex manifest's `mcpServers`
     * field. Slice 3.3 fix-A — velocity-qa VM verify failure #1.
     */
    mcpServers: PluginMcpServerSummary[];
}
export interface AgentReference {
    /** agent name (from agent.yaml `name` field). */
    agentName: string;
    /** absolute path to agent.yaml. */
    sourcePath: string;
    /** profile names that include this plugin in their uses.plugins[]. */
    profiles: string[];
    /** Profile consumer, or a resource declaration with no consuming profile. */
    kind?: "consumer" | "definition";
}
export interface PluginDiscoveryServiceOpts {
    /** Root directory for vendored OpenRig plugins (typically ~/.openrig/plugins). */
    openrigPluginsDir: string;
    /** Root directory for Claude Code plugin cache (typically ~/.claude/plugins/cache). */
    claudeCacheDir: string;
    /** Root directory for Codex plugin cache (typically ~/.codex/plugins/cache). */
    codexCacheDir: string;
    /** User spec library directory containing agent.yaml files (recursively scanned). */
    specLibraryDir: string;
    /** Additional spec roots visible in the library, including built-in and legacy user specs. */
    additionalSpecLibraryDirs?: string[];
    /**
     * Slice 3.3 fix-C — optional rig cwd roots whose `.claude/plugins/*` +
     * `.codex/plugins/*` subdirectories get scanned for rig-bundled
     * plugins (the projection target from IMPL-PRD §1.2). Default empty.
     * Population at v0 is per-call via listPlugins({ cwdScanRoots }) from
     * the API layer (?cwd=<path>); future slices may add automatic
     * enumeration from running-rig state.
     */
    cwdScanRoots?: string[];
}
export interface ListPluginsOpts {
    /** Filter to plugins supporting a specific runtime. */
    runtimeFilter?: PluginRuntime;
    /** Filter to plugins from a specific source root. */
    sourceFilter?: PluginSourceKind;
    /**
     * Slice 3.3 fix-C — per-call rig cwd roots; overrides constructor option.
     * Each cwd contributes `<cwd>/.claude/plugins/*` + `<cwd>/.codex/plugins/*`
     * discoveries labeled `rig-cwd:<plugin>`. The API layer passes a single
     * `?cwd=<path>` query param down here.
     */
    cwdScanRoots?: string[];
}
export declare class PluginDiscoveryService {
    private readonly opts;
    constructor(opts: PluginDiscoveryServiceOpts);
    listPlugins(filterOpts?: ListPluginsOpts): PluginEntry[];
    private scanCwdBundledPlugins;
    getPlugin(id: string): PluginDetail | null;
    findUsedBy(pluginId: string): AgentReference[];
    /**
     * Before openrig-core became the sole refocus provider, openrig-lab shipped
     * the same registrations. Upgrade installs can retain that old lab plugin,
     * so remove only its refocus commands before validating unknown conflicts.
     * The hook registry is written first: an interrupted migration therefore
     * leaves the obsolete provider disabled even if its manifest still points
     * at the now-empty registry.
     */
    private retireObsoleteLabRefocusHooks;
    /**
     * Runtime plugin loaders activate every vendored manifest, so the same hook
     * registered by two plugins fires twice. Reject that load shape before the
     * discovery service can describe it as healthy. Cache entries are excluded:
     * multiple cached versions are inventory, not simultaneous providers.
     */
    private assertNoDuplicateVendoredHooks;
    private detectPlugin;
}
//# sourceMappingURL=plugin-discovery-service.d.ts.map